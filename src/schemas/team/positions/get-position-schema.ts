// src/schemas/team/positions/get-position-schema.ts
import z from 'zod'
import { positionTypeSchema } from './position-type-schema'

/**
 * Schema para validar os parâmetros da URL para buscar uma posição específica
 */
export const getPositionParamsSchema = z.object({
  userId: z
    .string()
    .uuid('ID de usuário inválido. Deve ser um UUID válido.')
    .describe(
      'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
    ),
})

/**
 * Schema para validar a resposta de busca de posição
 */
export const getPositionResponseSchema = z
  .object({
    position: z
      .object({
        id: z
          .string()
          .uuid()
          .describe(
            'Identificador único da posição no formato UUID v4. Campo obrigatório.',
          ),
        userId: z
          .string()
          .uuid()
          .describe(
            'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
          ),
        type: positionTypeSchema.describe(
          'Tipo da posição. Campo obrigatório.',
        ),
        level: z
          .number()
          .int()
          .min(1)
          .max(5)
          .describe('Nível hierárquico da posição (1-5). Campo obrigatório.'),
        userName: z
          .string()
          .nullable()
          .describe(
            'Nome do membro. Pode ser nulo se não definido. Campo obrigatório.',
          ),
        userEmail: z
          .string()
          .email()
          .describe('Email do membro. Campo obrigatório.'),
        userAvatar: z
          .string()
          .nullable()
          .describe(
            'URL do avatar do membro. Pode ser nulo. Campo obrigatório.',
          ),
        assignedByName: z
          .string()
          .nullable()
          .describe(
            'Nome de quem nomeou o membro. Pode ser nulo. Campo obrigatório.',
          ),
        assignedByEmail: z
          .string()
          .email()
          .describe('Email de quem nomeou o membro. Campo obrigatório.'),
        createdAt: z
          .string()
          .describe(
            'Data e hora da nomeação no formato ISO 8601. Campo obrigatório.',
          ),
      })
      .nullable()
      .describe('Dados da posição encontrada ou null se não encontrada.'),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Posição recuperada com sucesso')

// Types inferidos
export type GetPositionParamsInput = z.infer<typeof getPositionParamsSchema>
export type GetPositionResponse = z.infer<typeof getPositionResponseSchema>
