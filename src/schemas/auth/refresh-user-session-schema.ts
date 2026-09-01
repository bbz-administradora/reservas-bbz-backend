// src/schemas/auth/refresh-user-session-schema.ts
import z from 'zod'

// Schema para validar a resposta
export const refreshUserSessionResponseSchema = z
  .object({
    userId: z
      .string()
      .uuid()
      .describe(
        'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
      ),
    sessionId: z
      .string()
      .uuid()
      .describe(
        'Identificador único da sessão no formato UUID v4. Campo obrigatório.',
      ),
  })
  .describe('Sessão atualizada com sucesso')

// Type inferido para a resposta
export type RefreshUserSessionResponse = z.infer<
  typeof refreshUserSessionResponseSchema
>
