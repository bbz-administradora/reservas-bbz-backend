// src/schemas/auth/logout-user-schema.ts
import z from 'zod'

// Schema para validar a resposta
export const logoutUserResponseSchema = z
  .object({
    message: z.string(),
  })
  .describe('Usuário desconectado com sucesso')
