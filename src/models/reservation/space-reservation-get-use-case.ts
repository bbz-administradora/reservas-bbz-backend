// src/models/reservation/reservation-get-detail-use-case.ts
import { NotFoundErrorSchema } from '@/@types/http-errors-schema'
import { NotFoundError } from '@/infra/errors'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import {
  ReservationGetDetailParamsInput,
  ReservationGetDetailResponse,
} from '@/schemas/reservation/space-reservation-get-detail-schema'

interface InputProps {
  data: ReservationGetDetailParamsInput
}

interface Dependencies {
  spaceReservationRepository: PgSpaceReservationRepository
}

export async function getSpaceReservationDetail(
  input: InputProps,
  deps: Dependencies,
): Promise<ReservationGetDetailResponse> {
  const { id } = input.data

  // Buscar a reserva pelo ID
  const reservation =
    await deps.spaceReservationRepository.getReservationDetailById(id)

  // Se a reserva não existir, lançar erro 404
  if (!reservation) {
    throw new NotFoundError({
      message: 'Reserva não encontrada',
      action: 'Verifique o ID da reserva e tente novamente',
      details: {
        where: 'reservation.getDetail',
        reservationId: id,
      },
    })
  }

  // Extrair os valores de slotRange para criar slotStart e slotEnd
  const [slotStart, slotEnd] = reservation.slotRange

  // Construir o objeto de retorno conforme o schema reservationDetailSchema
  const formattedReservation = {
    ...reservation,
    slotStart,
    slotEnd,
  }

  // Retornar os detalhes da reserva
  return {
    reservation: formattedReservation,
    message: 'Detalhes da reserva recuperados com sucesso',
  }
}

export const getSpaceReservationDetailSchema = {
  404: NotFoundErrorSchema,
}
