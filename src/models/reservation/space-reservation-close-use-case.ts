// src/models/reservation/space-reservation-close-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { ISpaceSlotRepository } from '@/repositories/base/space-slot-repository'
import { ISpaceRepository } from '@/repositories/base/spaces-repository'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import {
  SpaceReservationCloseBodyInput,
  SpaceReservationCloseResponse,
} from '@/schemas/reservation/space-reservation-close-schema'
import {
  getPlanningDeadline,
  getWeekRangeForDate,
  isPlanningDeadlineExpired,
} from '@/utils/date-utils'
import { sendEmail } from '@/utils/email'
import { differenceInHours, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Mapeamento de posições para labels em português
 */
const POSITION_LABELS: Record<string, string> = {
  director: 'Diretor(a)',
  supervisor: 'Supervisor(a)',
  manager: 'Gerente',
  assistant_manager: 'Subgerente',
  assistant: 'Assistente',
}

export interface CloseSpaceReservationInput {
  body: SpaceReservationCloseBodyInput
  userId: string
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
  spaceSlotRepository: ISpaceSlotRepository
  spaceRepository: ISpaceRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

export async function closeSpaceReservation(
  { body, userId }: CloseSpaceReservationInput,
  deps: Dependencies,
): Promise<SpaceReservationCloseResponse> {
  const { id: reservationId, spaceSlotIds = [] } = body

  // 1. Verificações preliminares - validamos se os dados essenciais estão presentes
  if (!reservationId && spaceSlotIds.length === 0) {
    throw new BadRequestError({
      message: 'Dados incompletos para fechar a reserva',
      action: 'Forneça id ou spaceSlotIds para fechar a reserva',
      details: {
        where: 'reservation.close',
        reservationId,
        spaceSlotIdsCount: spaceSlotIds.length,
        userId,
      },
    })
  }

  // 2. Verificar se a reserva existe
  let reservation = null
  if (reservationId) {
    reservation = await deps.spaceReservationRepository.findById(reservationId)
  } else if (spaceSlotIds.length > 0) {
    reservation =
      await deps.spaceReservationRepository.findBySpaceSlotIds(spaceSlotIds)
  }

  if (!reservation) {
    throw new NotFoundError({
      message: 'Reserva não encontrada',
      action: 'Verifique se o ID da reserva está correto e tente novamente',
      details: {
        where: 'reservation.close',
        reservationId,
        spaceSlotIds,
        userId,
      },
    })
  }

  // 3. Verificar se o usuário é o dono da reserva
  if (reservation.userId !== userId) {
    throw new ForbiddenError({
      message: 'Você não tem permissão para fechar esta reserva',
      action: 'Apenas o usuário que criou a reserva pode fechá-la',
      details: {
        where: 'reservation.close',
        reservationId: reservation.id,
        reservationOwnerId: reservation.userId,
        requestUserId: userId,
        reason: 'not_owner',
      },
    })
  }

  // 4. Verificar se a reserva está no status adequado (deve estar reservada)
  if (reservation.status !== 'reserved') {
    throw new BadRequestError({
      message: 'A reserva não pode ser fechada',
      action: 'Apenas reservas com status "reserved" podem ser fechadas',
      details: {
        where: 'reservation.close',
        reservationId: reservation.id,
        currentStatus: reservation.status,
        expectedStatus: 'reserved',
        userId,
      },
    })
  }

  // 5. Verificar se é uma sala ou workstation, se for workstation só pode fechar se faltar mais de 24h para o início
  const space = await deps.spaceRepository.findById(reservation.spaceId)

  // Se não encontrar o espaço, já emite erro
  if (!space) {
    throw new NotFoundError({
      message: 'Espaço da reserva não encontrado',
      action: 'Verifique se o espaço ainda existe no sistema',
      details: {
        where: 'reservation.close',
        reservationId: reservation.id,
        spaceId: reservation.spaceId,
        userId,
      },
    })
  }

  // Se for workstation, aplicar a regra de 24h de antecedência
  if (space.type === 'workstation') {
    const now = new Date()
    const slotStart = new Date(reservation.slotRange[0])

    // Usar date-fns para calcular a diferença em horas
    const hoursDifference = differenceInHours(slotStart, now)

    if (hoursDifference < 24) {
      throw new BadRequestError({
        message: 'Workstations só podem ser fechadas com 24h de antecedência',
        action:
          'Reservas de workstation só podem ser fechadas se faltarem mais de 24 horas para o início',
        details: {
          where: 'reservation.close',
          reservationId: reservation.id,
          spaceId: reservation.spaceId,
          spaceType: space.type,
          slotStart: reservation.slotRange[0],
          hoursDifference,
          minimumHours: 24,
          userId,
        },
      })
    }
  }

  // 6. Fechar a reserva
  const closedReservation =
    await deps.spaceReservationRepository.closeReservation(
      reservation.id,
      userId,
    )

  // 7. Garantir que o closedAt nunca seja null, usando a data atual como fallback
  const closedAt = closedReservation.closedAt || new Date().toISOString()

  // 8. Notificar supervisor se for workstation e prazo de planejamento expirou
  // Regra: Se o fechamento ocorrer após quinta-feira da semana W-1 para reserva na semana W,
  // o supervisor do colaborador recebe notificação por e-mail.
  if (space.type === 'workstation') {
    const now = new Date()
    const slotStart = new Date(reservation.slotRange[0])

    if (isPlanningDeadlineExpired(slotStart, now)) {
      // Buscar a posição do colaborador na equipe
      const employeePosition =
        await deps.teamPositionsRepository.findByUserId(userId)

      // Só notifica se o usuário tem posição na equipe de atendimento
      if (employeePosition) {
        // Buscar os supervisores do colaborador
        const supervisors =
          await deps.teamMemberSupervisorsRepository.listSupervisors(
            employeePosition.id,
          )

        // Enviar e-mail para cada supervisor
        for (const supervisor of supervisors) {
          const positionLabel =
            POSITION_LABELS[employeePosition.position] ||
            employeePosition.position

          // Calcula o prazo de planejamento usando o início da semana da reserva
          const { startDate: weekStart } = getWeekRangeForDate(slotStart)
          const planningDeadline = getPlanningDeadline(weekStart)

          // O nome do colaborador vem do próprio vínculo hierárquico (subordinado)
          const employeeName =
            supervisor.subordinateUserName?.split(' ')[0] || 'Colaborador'

          await sendEmail({
            to: supervisor.supervisorUserEmail,
            type: 'SUPERVISOR_RESERVATION_CANCELLED',
            data: {
              supervisorName:
                supervisor.supervisorUserName?.split(' ')[0] || 'Supervisor',
              employeeName,
              employeePosition: positionLabel,
              reservationDate: format(slotStart, "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              }),
              reservationDay: format(slotStart, 'EEEE', { locale: ptBR }),
              cancelledAt: format(now, "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              }),
              workstationName: space.name,
              planningDeadline: format(
                planningDeadline,
                "dd/MM/yyyy 'às' 23:59",
                { locale: ptBR },
              ),
            },
          })
        }
      }
    }
  }

  // 9. Verificar e excluir os slots de espaço associados à reserva fechada, apenas se ainda existirem
  // (podem ter sido deletados pelo job agendado de 24h)
  // OTIMIZAÇÃO: Usa deleteByIds para deletar todos de uma vez (1 query ao invés de 2N)
  if (
    closedReservation.spaceSlotIds &&
    closedReservation.spaceSlotIds.length > 0
  ) {
    // deleteByIds ignora silenciosamente IDs que não existem, então é seguro
    await deps.spaceSlotRepository.deleteByIds(closedReservation.spaceSlotIds)
  }

  // 10. Retornar a resposta formatada conforme o schema
  return {
    reservation: {
      id: closedReservation.id,
      spaceId: closedReservation.spaceId,
      userId: closedReservation.userId,
      slotStart: closedReservation.slotRange[0],
      slotEnd: closedReservation.slotRange[1],
      spaceSlotIds: closedReservation.spaceSlotIds,
      bbzCollaborators: closedReservation.bbzCollaborators,
      externalGuests: closedReservation.externalGuests,
      needsCopeira: closedReservation.needsCopeira,
      status: closedReservation.status,
      closedAt: closedAt,
    },
    message: 'Reserva fechada com sucesso',
  }
}

export const closeSpaceReservationSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
