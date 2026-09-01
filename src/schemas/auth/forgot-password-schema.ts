// src/schemas/auth/forgot-password-schema.ts
import { emailSchema } from '@/schemas'
import z from 'zod'

// Schema para validar o corpo da requisição
export const forgotPasswordBodySchema = z.object({
  email: emailSchema.describe(
    'Email do usuário para envio do token de redefinição de senha. Deve ser um endereço de email válido entre 3 e 254 caracteres. Campo obrigatório.',
  ),
})

// Schema para validar a resposta
export const forgotPasswordResponseSchema = z
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
        'Mensagem informativa sobre o envio do email de redefinição de senha. Campo obrigatório.',
      ),
  })
  .describe('Email para redefinição de senha enviado com sucesso')

// Types inferidos
export type ForgotPasswordBodyInput = z.infer<typeof forgotPasswordBodySchema>
export type ForgotPasswordResponse = z.infer<
  typeof forgotPasswordResponseSchema
>

// Type combinado para input
export type ForgotPasswordInput = ForgotPasswordBodyInput
