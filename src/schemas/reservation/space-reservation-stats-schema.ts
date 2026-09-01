import z from 'zod'

// Resposta: total, próxima reserva, e três horários mais usados
export const spaceReservationStatsResponseSchema = z.object({
  total: z
    .number()
    .int()
    .nonnegative()
    .describe('Número total de reservas para o usuário'),
  nextReservation: z
    .string()
    .nullable()
    .describe(
      "Data e hora da próxima reserva no formato 'dd/MM/yyyy às HH:mm', ou null se não houver",
    ),
  mostUsedStartTimes: z
    .array(z.string().regex(/^\d{2}:\d{2}$/))
    .length(3)
    .describe(
      'Array com os três horários de início mais utilizados, do menor para o maior, formato HH:mm',
    ),
})

export type SpaceReservationStatsResponse = z.infer<
  typeof spaceReservationStatsResponseSchema
>
