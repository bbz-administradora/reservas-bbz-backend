// src/schemas/auth/reset-password-schema.ts
import { passwordSchema } from '@/schemas'
import z from 'zod'

// Schema para validar os parâmetros da URL
export const resetPasswordParamsSchema = z.object({
  userId: z
    .string()
    .uuid('ID de usuário inválido')
    .describe(
      'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
    ),
  token: z
    .string()
    .uuid('Token inválido')
    .describe(
      'Token de verificação para redefinição de senha no formato UUID v4. Campo obrigatório.',
    ),
})

// Schema para validar o corpo da requisição
export const resetPasswordBodySchema = z.object({
  password: passwordSchema.describe(
    'Nova senha do usuário. Deve conter pelo menos 8 caracteres, uma letra maiúscula, uma letra minúscula, um número e um símbolo. Campo obrigatório.',
  ),
})

// Schema para validar a resposta
export const resetPasswordResponseSchema = z
  .object({
    userId: z
      .string()
      .uuid()
      .describe(
        'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
      ),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da redefinição de senha. Campo obrigatório.',
      ),
  })
  .describe('Senha redefinida com sucesso')

// Types inferidos
export type ResetPasswordParamsInput = z.infer<typeof resetPasswordParamsSchema>
export type ResetPasswordBodyInput = z.infer<typeof resetPasswordBodySchema>
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>

// Type combinado para input
export type ResetPasswordInput = ResetPasswordParamsInput &
  ResetPasswordBodyInput
