// src/models/reservation/space-reservation-cancel-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, NotFoundError } from '@/infra/errors'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { ISpaceSlotRepository } from '@/repositories/base/space-slot-repository'
import {
  SpaceReservationCancelBodyInput,
  SpaceReservationCancelResponse,
} from '@/schemas/reservation/space-reservation-cancel-schema'

export interface CancelSpaceReservationInput {
  body: SpaceReservationCancelBodyInput
  userId: string
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
  spaceSlotRepository: ISpaceSlotRepository
}

export async function cancelSpaceReservation(
  { body, userId }: CancelSpaceReservationInput,
  deps: Dependencies,
): Promise<SpaceReservationCancelResponse> {
  const { id: reservationId, spaceSlotIds = [], cancelReason } = body

  // 1. Verificações preliminares - validamos se os dados essenciais estão presentes
  if ((!reservationId && spaceSlotIds.length === 0) || !cancelReason) {
    throw new BadRequestError({
      message: 'Dados incompletos para cancelar a reserva',
      action:
        'Forneça id ou spaceSlotIds e cancelReason para cancelar a reserva',
      details: {
        where: 'reservation.cancel',
        reservationId,
        spaceSlotIdsCount: spaceSlotIds.length,
        hasCancelReason: !!cancelReason,
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
        where: 'reservation.cancel',
        reservationId,
        spaceSlotIds,
        userId,
      },
    })
  }

  // 3. Verificar se a reserva está no status adequado (deve estar reservada)
  if (reservation.status !== 'reserved') {
    throw new BadRequestError({
      message: 'A reserva não pode ser cancelada',
      action: 'Apenas reservas com status "reserved" podem ser canceladas',
      details: {
        where: 'reservation.cancel',
        reservationId: reservation.id,
        currentStatus: reservation.status,
        expectedStatus: 'reserved',
        userId,
      },
    })
  }

  // 4. Cancelar a reserva
  const cancelledReservation =
    await deps.spaceReservationRepository.cancelReservation(
      reservation.id,
      userId,
      cancelReason,
    )

  // 5. Garantir que o cancelledAt nunca seja null, usando a data atual como fallback
  const cancelledAt =
    cancelledReservation.cancelledAt || new Date().toISOString()

  // 6. Verificar e excluir os slots de espaço associados à reserva cancelada, apenas se ainda existirem
  // (podem ter sido deletados pelo job agendado de 24h)
  // OTIMIZAÇÃO: Usa deleteByIds para deletar todos de uma vez (1 query ao invés de 2N)
  if (
    cancelledReservation.spaceSlotIds &&
    cancelledReservation.spaceSlotIds.length > 0
  ) {
    // deleteByIds ignora silenciosamente IDs que não existem, então é seguro
    await deps.spaceSlotRepository.deleteByIds(
      cancelledReservation.spaceSlotIds,
    )
  }

  // 7. Retornar a resposta formatada conforme o schema
  return {
    reservation: {
      id: cancelledReservation.id,
      spaceId: cancelledReservation.spaceId,
      userId: cancelledReservation.userId,
      slotStart: cancelledReservation.slotRange[0],
      slotEnd: cancelledReservation.slotRange[1],
      spaceSlotIds: cancelledReservation.spaceSlotIds,
      bbzCollaborators: cancelledReservation.bbzCollaborators,
      externalGuests: cancelledReservation.externalGuests,
      needsCopeira: cancelledReservation.needsCopeira,
      status: cancelledReservation.status,
      cancelledBy: cancelledReservation.cancelledBy!,
      cancelReason: cancelReason, // Use the original reason from the request
      cancelledAt: cancelledAt,
    },
    message: 'Reserva cancelada com sucesso',
  }
}

export const cancelSpaceReservationSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
