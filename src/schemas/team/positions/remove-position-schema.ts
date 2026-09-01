// src/schemas/team/positions/remove-position-schema.ts
import z from 'zod'
import { positionTypeSchema } from './position-type-schema'

/**
 * Schema para validar os parâmetros da URL para remoção de posição
 */
export const removePositionParamsSchema = z.object({
  userId: z
    .string()
    .uuid('ID de usuário inválido. Deve ser um UUID válido.')
    .describe(
      'Identificador único do usuário a ter sua posição removida no formato UUID v4. Campo obrigatório.',
    ),
})

/**
 * Schema para validar a resposta de sucesso da remoção de posição
 */
export const removePositionResponseSchema = z
  .object({
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
    userId: z
      .string()
      .uuid()
      .describe(
        'Identificador único do usuário que teve sua posição removida. Campo obrigatório.',
      ),
    positionRemoved: positionTypeSchema.describe(
      'Tipo da posição que foi removida. Campo obrigatório.',
    ),
  })
  .describe('Posição removida com sucesso')

// Types inferidos
export type RemovePositionParamsInput = z.infer<
  typeof removePositionParamsSchema
>
export type RemovePositionResponse = z.infer<
  typeof removePositionResponseSchema
>
