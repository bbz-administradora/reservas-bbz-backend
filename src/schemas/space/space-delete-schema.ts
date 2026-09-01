// src/schemas/space/space-delete-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const spaceDeleteParamsSchema = z.object({
  id: z.string().uuid('ID inválido, deve ser um UUID'),
})

// Tipagem para os parâmetros da URL
export type SpaceDeleteParamsInput = z.infer<typeof spaceDeleteParamsSchema>

// Schema para validar a resposta
export const spaceDeleteResponseSchema = z
  .object({
    message: z.string(),
  })
  .describe('Espaço excluído com sucesso')
