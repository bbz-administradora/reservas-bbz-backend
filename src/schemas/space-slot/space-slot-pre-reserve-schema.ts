// src/schemas/space-slot/space-slot-pre-reserve-schema.ts
import z from 'zod'

// Schema para validar o corpo da requisição
export const spaceSlotPreReserveBodySchema = z.object({
  spaceId: z
    .string({
      required_error: 'ID do espaço é obrigatório',
    })
    .uuid('ID do espaço inválido, deve ser um UUID'),
  slotStart: z
    .string({
      required_error: 'Horário de início é obrigatório',
    })
    .datetime({
      offset: true,
      message:
        'Horário de início inválido, deve ser uma string ISO com timezone',
    })
    .describe(
      'Horário de início da reserva no formato ISO com timezone do usuário',
    ),
  slotEnd: z
    .string({
      required_error: 'Horário de término é obrigatório',
    })
    .datetime({
      offset: true,
      message:
        'Horário de término inválido, deve ser uma string ISO com timezone',
    })
    .describe(
      'Horário de término da reserva no formato ISO com timezone do usuário',
    ),
  status: z
    .enum(['pre_reserved', 'reserved'], {
      required_error: 'Status é obrigatório',
    })
    .default('pre_reserved')
    .describe('Status da reserva - deve ser pre_reserved para pré-reservas'),
})

// Tipagem para o corpo da requisição
export type SpaceSlotPreReserveBodyInput = z.infer<
  typeof spaceSlotPreReserveBodySchema
>

// Schema para validar a resposta
export const spaceSlotPreReserveResponseSchema = z.object({
  slot: z.object({
    id: z.string().uuid().describe('Identificador único do slot'),
    spaceId: z.string().uuid().describe('Identificador único do espaço'),
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
    status: z
      .enum(['pre_reserved', 'reserved'])
      .describe('Status do slot - sempre pre_reserved para este endpoint'),
    userId: z.string().uuid().describe('ID do usuário que fez a pré-reserva'),
    preReservedUntil: z
      .string()
      .datetime({
        offset: true,
        message: 'Formato de data/hora inválido',
      })
      .describe('Data e hora até quando o slot está pré-reservado'),
  }),
  message: z.string().describe('Mensagem de sucesso'),
})

// Tipagem para a resposta
export type SpaceSlotPreReserveResponse = z.infer<
  typeof spaceSlotPreReserveResponseSchema
>
