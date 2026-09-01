// src/schemas/team/positions/list-positions-schema.ts
import z from 'zod'
import { positionTypeSchema } from './position-type-schema'

/**
 * Schema para validar os parâmetros da URL para listagem de posições
 */
export const listPositionsParamsSchema = z.object({
  position: positionTypeSchema.describe(
    'Tipo da posição a ser listada. Valores válidos: director, supervisor, manager, assistant_manager, assistant. Campo obrigatório.',
  ),
})

/**
 * Schema para validar a resposta de listagem de posições
 *
 * Retorna todos os membros da posição especificada com seus dados básicos
 * e informações de quem os nomeou.
 */
export const listPositionsResponseSchema = z
  .object({
    positions: z
      .array(
        z.object({
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
        }),
      )
      .describe('Lista de membros nomeados na posição.'),
    total: z
      .number()
      .int()
      .min(0)
      .describe('Número total de membros nomeados. Campo obrigatório.'),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Lista de posições recuperada com sucesso')

// Types inferidos
export type ListPositionsParamsInput = z.infer<typeof listPositionsParamsSchema>
export type ListPositionsResponse = z.infer<typeof listPositionsResponseSchema>
