import {
  BadRequestErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError } from '@/infra/errors'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { IUserRepository } from '@/repositories/base/users-repository'
import { SpaceReservationListResponse } from '@/schemas/reservation/space-reservation-list-schema'

export interface ListSpaceReservationsInput {
  page?: number
  pageSize?: number
  userId: string | null
  spaceId?: string | null
  includeUserAsGuest?: boolean
  startDate?: string
  endDate?: string
  teamOnly?: boolean
  requestUser?: {
    id: string
    role: 'dev' | 'admin' | 'user'
    teamPosition:
      | 'director'
      | 'supervisor'
      | 'manager'
      | 'assistant_manager'
      | 'assistant'
      | null
  }
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
  userRepository: IUserRepository
  teamPositionsRepository?: ITeamPositionsRepository
  teamMemberSupervisorsRepository?: ITeamMemberSupervisorsRepository
}

export async function listSpaceReservations(
  {
    page = 1,
    pageSize = 10000,
    userId = null,
    spaceId = null,
    includeUserAsGuest = false,
    startDate,
    endDate,
    teamOnly = false,
    requestUser,
  }: ListSpaceReservationsInput,
  deps: Dependencies,
): Promise<SpaceReservationListResponse> {
  // 1. Validar valores de paginação
  if (page < 1) {
    throw new BadRequestError({
      message: 'Número de página inválido',
      action: 'O número da página deve ser maior ou igual a 1',
      details: {
        where: 'reservation.list',
        page,
        pageSize,
        userId,
        spaceId,
      },
    })
  }

  if (pageSize < 1 || pageSize > 10000) {
    throw new BadRequestError({
      message: 'Tamanho de página inválido',
      action: 'O tamanho da página deve estar entre 1 e 10000',
      details: {
        where: 'reservation.list',
        page,
        pageSize,
        minPageSize: 1,
        maxPageSize: 10000,
        userId,
        spaceId,
      },
    })
  }

  // 2. Se teamOnly for true, buscar os subordinados do supervisor
  let teamUserIds: string[] | undefined = undefined

  if (
    teamOnly &&
    requestUser &&
    deps.teamPositionsRepository &&
    deps.teamMemberSupervisorsRepository
  ) {
    // Buscar a posição do usuário autenticado
    const userPosition = await deps.teamPositionsRepository.findByUserId(
      requestUser.id,
    )

    if (userPosition) {
      // Buscar todos os subordinados recursivamente
      const subordinates =
        await deps.teamMemberSupervisorsRepository.listAllSubordinatesRecursive(
          userPosition.id,
        )

      // Extrair os IDs dos usuários subordinados
      teamUserIds = subordinates.map((sub) => sub.subordinateUserId)

      // Se não há subordinados, retornar lista vazia
      if (teamUserIds.length === 0) {
        return {
          reservations: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
        }
      }
    }
  }

  // 3. Se includeUserAsGuest for true, precisamos buscar o email do usuário
  let userEmail: string | undefined = undefined

  if (userId && includeUserAsGuest) {
    const user = await deps.userRepository.findById(userId)
    if (user) {
      userEmail = user.email
    }
  }

  // 4. Buscar as reservas paginadas
  const result = await deps.spaceReservationRepository.listReservations(
    page,
    pageSize,
    {
      userId: userId || undefined,
      spaceId: spaceId || undefined,
      includeUserAsGuest,
      userEmail,
      startDate,
      endDate,
      userIds: teamUserIds,
    },
  )

  // 3. Verificar se existem resultados
  if (result.totalCount === 0) {
    return {
      reservations: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: page,
    }
  }

  // 4. Transformar os resultados para incluir slotStart e slotEnd conforme requerido pelo schema
  const transformedReservations = result.reservations.map((reservation) => {
    // Se tivermos slotRange, extraímos slotStart e slotEnd dele
    let slotStart: string | undefined
    let slotEnd: string | undefined

    // Extrair do slotRange da reservação (sempre disponível)
    if (
      reservation.slotRange &&
      Array.isArray(reservation.slotRange) &&
      reservation.slotRange.length === 2
    ) {
      ;[slotStart, slotEnd] = reservation.slotRange
    }

    // Transformar os registros de check-in/check-out para incluir userName
    const transformedCheckInOuts = (reservation.checkInOuts || []).map(
      (checkInOut) => {
        return {
          ...checkInOut,
          // Adiciona o userName que é obrigatório no schema mas pode estar faltando no repositório
          userName: checkInOut.userName || reservation.user.name,
        }
      },
    )

    // Construir o objeto de reserva transformado
    return {
      id: reservation.id,
      space: reservation.space,
      user: reservation.user,
      spaceSlotIds: reservation.spaceSlotIds,
      slotStart: slotStart || '', // Fallback para string vazia se não estiver disponível
      slotEnd: slotEnd || '', // Fallback para string vazia se não estiver disponível
      bbzCollaborators: reservation.bbzCollaborators,
      externalGuests: reservation.externalGuests,
      needsCopeira: reservation.needsCopeira,
      status: reservation.status,
      cancelledBy: reservation.cancelledBy,
      cancelReason: reservation.cancelReason,
      cancelledAt: reservation.cancelledAt,
      closedAt: reservation.closedAt,
      createdAt: reservation.createdAt,
      checkInOuts: transformedCheckInOuts,
    }
  })

  // 5. Retornar os resultados transformados
  return {
    ...result,
    reservations: transformedReservations,
  }
}

export const listSpaceReservationsSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
}
