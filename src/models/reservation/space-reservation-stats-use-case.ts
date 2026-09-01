import { BadRequestErrorSchema } from '@/@types/http-errors-schema'
import { BadRequestError } from '@/infra/errors'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { SpaceReservationStatsResponse } from '@/schemas/reservation/space-reservation-stats-schema'

export interface GetSpaceReservationStatsInput {
  userId: string
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
}

export async function getSpaceReservationStats(
  { userId }: GetSpaceReservationStatsInput,
  deps: Dependencies,
): Promise<SpaceReservationStatsResponse> {
  if (!userId) {
    throw new BadRequestError({
      message: 'ID do usuário é obrigatório',
      action: 'Forneça um userId válido para buscar estatísticas de reservas',
      details: {
        where: 'reservation.stats',
        userId,
      },
    })
  }

  const stats =
    await deps.spaceReservationRepository.getUserReservationStats(userId)

  const defaultTimes = ['10:00', '14:00', '16:00']

  // Crie uma cópia dos horários que podemos modificar
  let finalTimes: string[] = [...stats.mostUsedStartTimes]

  if (finalTimes.length === 0) {
    // Caso sem reservas - use valores padrão
    finalTimes = [...defaultTimes]
  } else if (finalTimes.length < 3) {
    // Preserve os horários reais das reservas
    const realTimes = [...finalTimes]

    // Adicione valores padrão apenas se o horário real não for um dos valores padrão
    const availableDefaults = defaultTimes.filter(
      (time) => !realTimes.includes(time),
    )

    // Limpe a lista e coloque os horários reais primeiro
    finalTimes = [...realTimes]

    // Adicione valores padrão até termos 3 horários
    while (finalTimes.length < 3 && availableDefaults.length > 0) {
      finalTimes.push(availableDefaults.shift()!)
    }
  }

  // Ordene os horários em ordem crescente
  finalTimes.sort()

  // Pegue apenas os 3 primeiros horários
  const result = finalTimes.slice(0, 3) as [string, string, string]

  return {
    ...stats,
    mostUsedStartTimes: result,
  }
}

export const getSpaceReservationStatsSchema = {
  400: BadRequestErrorSchema,
}
