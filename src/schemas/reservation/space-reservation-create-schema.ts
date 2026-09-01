// src/schemas/reservation/create/space-reservation-create-schema.ts
import z from 'zod'

// Schema para validar o corpo da requisição
export const spaceReservationCreateBodySchema = z.object({
  spaceId: z
    .string({
      required_error: 'ID do espaço é obrigatório',
    })
    .uuid('ID do espaço inválido, deve ser um UUID')
    .describe('Identificador único do espaço a ser reservado'),

  spaceSlotIds: z
    .array(
      z
        .string({
          required_error: 'ID do slot é obrigatório',
        })
        .uuid('ID do slot inválido, deve ser um UUID'),
    )
    .min(1, 'É necessário informar pelo menos um slot')
    .describe(
      'Lista de identificadores únicos dos slots de tempo pré-reservados',
    ),

  bbzCollaborators: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Lista de colaboradores da BBZ que participarão da reunião'),

  externalGuests: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Lista de convidados externos que participarão da reunião'),

  needsCopeira: z
    .boolean()
    .optional()
    .default(false)
    .describe('Indica se a reserva necessita de serviço de copeira'),
})

// Tipagem para o corpo da requisição
export type SpaceReservationCreateBodyInput = z.infer<
  typeof spaceReservationCreateBodySchema
>

// Schema para validar a resposta
export const spaceReservationCreateResponseSchema = z.object({
  reservations: z.array(
    z.object({
      id: z.string().uuid().describe('Identificador único da reserva'),
      spaceId: z.string().uuid().describe('Identificador único do espaço'),
      userId: z
        .string()
        .uuid()
        .describe('Identificador único do usuário que fez a reserva'),
      slotStart: z
        .string()
        .datetime({
          offset: true,
          message: 'Formato de data/hora inválido',
        })
        .describe(
          'Horário de início do slot no formato ISO com timezone do usuário',
        ),
      slotEnd: z
        .string()
        .datetime({
          offset: true,
          message: 'Formato de data/hora inválido',
        })
        .describe(
          'Horário de término do slot no formato ISO com timezone do usuário',
        ),
      spaceSlotIds: z
        .array(z.string().uuid())
        .describe('Array de identificadores únicos dos slots de tempo'),
      bbzCollaborators: z
        .array(z.string())
        .describe('Lista de colaboradores da BBZ'),
      externalGuests: z
        .array(z.string())
        .describe('Lista de convidados externos'),
      needsCopeira: z
        .boolean()
        .describe('Indica se a reserva necessita de serviço de copeira'),
      status: z
        .enum(['reserved', 'cancelled', 'closed'])
        .describe('Status atual da reserva'),
    }),
  ),
  message: z.string().describe('Mensagem de sucesso'),
})

// Tipagem para a resposta
export type SpaceReservationCreateResponse = z.infer<
  typeof spaceReservationCreateResponseSchema
>
