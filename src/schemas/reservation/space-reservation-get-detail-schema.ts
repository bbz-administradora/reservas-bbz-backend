// src/schemas/reservation/reservation-get-detail-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const reservationGetDetailParamsSchema = z.object({
  id: z
    .string({ required_error: 'ID da reserva é obrigatório' })
    .uuid('ID da reserva inválido, deve ser um UUID')
    .describe(
      'Identificador único da reserva no formato UUID v4. Campo obrigatório.',
    ),
})

// Schema para a resposta
export const reservationGetDetailResponseSchema = z
  .object({
    reservation: z
      .object({
        id: z.string().uuid().describe('Identificador único da reserva'),
        space: z
          .object({
            id: z.string().uuid().describe('Identificador único do espaço'),
            name: z.string().describe('Nome do espaço'),
            type: z.enum(['room', 'workstation']).describe('Tipo do espaço'),
            floor: z.string().nullable().describe('Andar do espaço'),
            zone: z.string().nullable().describe('Zona do espaço'),
            position: z.string().nullable().describe('Posição do espaço'),
          })
          .describe('Informações básicas do espaço'),
        spaceSlotIds: z
          .array(z.string().uuid())
          .describe(
            'Array de identificadores únicos dos slots de tempo reservados',
          ),
        user: z
          .object({
            id: z.string().uuid().describe('Identificador único do usuário'),
            name: z.string().describe('Nome do usuário'),
            email: z.string().email().describe('E-mail do usuário'),
          })
          .describe('Informações do usuário que fez a reserva'),
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
        bbzCollaborators: z
          .array(z.string())
          .describe('Lista de colaboradores da BBZ participantes'),
        externalGuests: z
          .array(z.string())
          .describe('Lista de convidados externos participantes'),
        needsCopeira: z
          .boolean()
          .describe('Indica se a reserva necessita de serviço de copeira'),
        status: z
          .enum(['reserved', 'cancelled', 'closed'])
          .describe('Status atual da reserva'),
        cancelledBy: z
          .object({
            id: z.string().uuid().describe('ID do usuário que cancelou'),
            name: z.string().describe('Nome do usuário que cancelou'),
          })
          .nullable()
          .describe('Usuário que cancelou a reserva (ou null)'),
        cancelReason: z
          .string()
          .nullable()
          .describe('Motivo do cancelamento (ou null)'),
        cancelledAt: z
          .string()
          .nullable()
          .describe('Data/hora do cancelamento (ou null)'),
        closedAt: z
          .string()
          .nullable()
          .describe('Data/hora do fechamento da reserva (ou null)'),
        createdAt: z.string().describe('Data/hora de criação da reserva'),
      })
      .describe('Detalhes completos de uma reserva paginada'),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Detalhes da reserva recuperados com sucesso.')

// Types inferidos
export type ReservationGetDetailParamsInput = z.infer<
  typeof reservationGetDetailParamsSchema
>
export type ReservationGetDetailResponse = z.infer<
  typeof reservationGetDetailResponseSchema
>
