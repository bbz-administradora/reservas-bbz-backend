// src/schemas/reservation/reservation-check-in-out-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da requisição
export const reservationCheckInOutParamsSchema = z.object({
  spaceId: z
    .string({ required_error: 'ID do espaço é obrigatório' })
    .uuid('ID do espaço inválido, deve ser um UUID')
    .describe(
      'Identificador único do espaço no formato UUID v4. Campo obrigatório.',
    ),
})

// Schema para validar o body da requisição
export const reservationCheckInOutBodySchema = z.object({
  reservationId: z
    .string({ required_error: 'ID da reserva é obrigatório' })
    .uuid('ID da reserva inválido, deve ser um UUID')
    .describe(
      'Identificador único da reserva no formato UUID v4. Campo obrigatório.',
    ),
  type: z
    .enum(['check-in', 'check-out'], {
      required_error: 'Tipo de operação é obrigatório',
      invalid_type_error:
        "Tipo de operação inválido. Use 'check-in' ou 'check-out'",
    })
    .describe(
      "Tipo de operação a ser realizada: 'check-in' para entrada ou 'check-out' para saída. Campo obrigatório.",
    ),
})

// Schema para a resposta
export const reservationCheckInOutResponseSchema = z
  .object({
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação (check-in ou check-out). Campo obrigatório.',
      ),
    reservation: z
      .object({
        id: z
          .string()
          .uuid()
          .describe(
            'Identificador único da reserva no formato UUID v4. Campo obrigatório.',
          ),
        checkInAt: z
          .string()
          .nullable()
          .describe(
            'Data e hora do check-in no formato ISO 8601. Pode ser nulo se apenas o check-out foi realizado. Campo obrigatório.',
          ),
        checkOutAt: z
          .string()
          .nullable()
          .describe(
            'Data e hora do check-out no formato ISO 8601. Pode ser nulo se apenas o check-in foi realizado. Campo obrigatório.',
          ),
        status: z
          .enum(['reserved', 'cancelled', 'closed'])
          .describe('Status atual da reserva. Campo obrigatório.'),
      })
      .describe(
        'Informações da reserva após a operação de check-in ou check-out',
      ),
  })
  .describe('Operação de check-in/check-out realizada com sucesso')

// Types inferidos
export type ReservationCheckInOutParamsInput = z.infer<
  typeof reservationCheckInOutParamsSchema
>
export type ReservationCheckInOutBodyInput = z.infer<
  typeof reservationCheckInOutBodySchema
>
export type ReservationCheckInOutResponse = z.infer<
  typeof reservationCheckInOutResponseSchema
>
