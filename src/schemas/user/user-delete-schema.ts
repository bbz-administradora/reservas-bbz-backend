// src/schemas/user/user-delete-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const userDeleteParamsSchema = z.object({
  id: z.string().uuid('ID de usuário inválido'),
})

// Tipagem para os parâmetros da URL
export type UserDeleteParamsInput = z.infer<typeof userDeleteParamsSchema>

// Schema para validar a resposta
export const userDeleteResponseSchema = z
  .object({
    message: z.string(),
    userId: z.string().uuid(),
  })
  .describe('Usuário excluído com sucesso')
