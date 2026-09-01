// src/schemas/user/booking-exception-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da requisição
export const bookingExceptionParamsSchema = z.object({
  userId: z
    .string()
    .uuid({ message: 'ID de usuário inválido' })
    .describe(
      'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
    ),
})

// Schema para validar o corpo da requisição
export const bookingExceptionBodySchema = z.object({
  active: z
    .boolean()
    .describe(
      'Indica se a exceção de prazo está ativa. true = ativa até sábado da semana, false = remove a exceção.',
    ),
})

// Schema para validar a resposta
export const bookingExceptionResponseSchema = z
  .object({
    user: z.object({
      id: z.string().uuid().describe('Identificador único do usuário.'),
      name: z.string().nullable().describe('Nome do usuário.'),
      email: z.string().email().describe('Email do usuário.'),
      bookingExceptionUntil: z
        .string()
        .nullable()
        .describe(
          'Data/hora limite da exceção em formato ISO. NULL se não há exceção ativa.',
        ),
    }),
    message: z
      .string()
      .describe('Mensagem informativa sobre o resultado da operação.'),
  })
  .describe('Detalhes do usuário com a exceção atualizada')

// Types inferidos
export type BookingExceptionParamsInput = z.infer<
  typeof bookingExceptionParamsSchema
>
export type BookingExceptionBodyInput = z.infer<
  typeof bookingExceptionBodySchema
>
export type BookingExceptionResponse = z.infer<
  typeof bookingExceptionResponseSchema
>
