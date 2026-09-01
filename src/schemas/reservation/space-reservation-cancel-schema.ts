// src/schemas/reservation/space-reservation-cancel-schema.ts
import z from 'zod'

// Schema para validar o corpo da requisição PATCH
export const spaceReservationCancelBodySchema = z
  .object({
    id: z
      .string({
        required_error: 'ID da reserva é obrigatório',
      })
      .uuid('ID da reserva inválido, deve ser um UUID')
      .optional()
      .describe('Identificador único da reserva a ser cancelada'),
    spaceSlotIds: z
      .array(z.string().uuid('ID do slot de tempo inválido, deve ser um UUID'))
      .optional()
      .describe(
        'Array de identificadores únicos dos slots de tempo associados à reserva',
      ),
    cancelReason: z
      .string({
        required_error: 'Motivo do cancelamento é obrigatório',
      })
      .min(3, 'Motivo do cancelamento deve ter pelo menos 3 caracteres')
      .max(500, 'Motivo do cancelamento deve ter no máximo 500 caracteres')
      .describe('Motivo do cancelamento da reserva'),
  })
  .describe('Corpo da requisição para cancelar uma reserva')

// Tipagem para o corpo da requisição
export type SpaceReservationCancelBodyInput = z.infer<
  typeof spaceReservationCancelBodySchema
>

// Schema para validar a resposta
export const spaceReservationCancelResponseSchema = z.object({
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
    cancelledBy: z
      .string()
      .uuid()
      .describe('Identificador único do usuário que cancelou a reserva'),
    cancelReason: z.string().describe('Motivo do cancelamento'),
    cancelledAt: z.string().describe('Data e hora do cancelamento da reserva'),
  }),
  message: z.string().describe('Mensagem de sucesso'),
})

// Tipagem para a resposta
export type SpaceReservationCancelResponse = z.infer<
  typeof spaceReservationCancelResponseSchema
>
