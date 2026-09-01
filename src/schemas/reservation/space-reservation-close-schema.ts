// src/schemas/reservation/space-reservation-close-schema.ts
import z from 'zod'

// Schema para validar o corpo da requisição PATCH
export const spaceReservationCloseBodySchema = z
  .object({
    id: z
      .string()
      .uuid('ID da reserva inválido, deve ser um UUID')
      .optional()
      .describe('Identificador único da reserva a ser fechada'),
    spaceSlotIds: z
      .array(z.string().uuid('ID do slot de tempo inválido, deve ser um UUID'))
      .optional()
      .describe(
        'Array de identificadores únicos dos slots de tempo associados à reserva',
      ),
  })
  .describe(
    'Corpo da requisição para fechar uma reserva (atualmente vazio, mas requerido para o formato PATCH)',
  )

// Tipagem para o corpo da requisição
export type SpaceReservationCloseBodyInput = z.infer<
  typeof spaceReservationCloseBodySchema
>

// Schema para validar a resposta
export const spaceReservationCloseResponseSchema = z.object({
  reservation: z.object({
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
    closedAt: z.string().describe('Data e hora do fechamento da reserva'),
  }),
  message: z.string().describe('Mensagem de sucesso'),
})

// Tipagem para a resposta
export type SpaceReservationCloseResponse = z.infer<
  typeof spaceReservationCloseResponseSchema
>
