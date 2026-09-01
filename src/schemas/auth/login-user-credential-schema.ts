// src/schemas/auth/login-user-credential-schema.ts
import { emailSchema, passwordSchema } from '@/schemas'
import z from 'zod'

// Schema para o corpo da requisição
export const loginUserCredentialBodySchema = z.object({
  email: emailSchema.describe(
    'Email do usuário para autenticação. Deve ser um endereço de email válido entre 3 e 254 caracteres. Campo obrigatório.',
  ),
  password: passwordSchema.describe(
    'Senha do usuário para autenticação. Deve conter pelo menos 8 caracteres, uma letra maiúscula, uma letra minúscula, um número e um símbolo. Campo obrigatório.',
  ),
})

// Schema para a resposta
export const loginUserCredentialResponseSchema = z
  .object({
    user: z.object({
      id: z
        .string()
        .uuid()
        .describe(
          'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
        ),
      name: z
        .string()
        .nullable()
        .describe(
          'Nome completo do usuário. Pode ser nulo. Campo obrigatório.',
        ),
      email: z
        .string()
        .email()
        .describe(
          'Email do usuário. Endereço de email válido. Campo obrigatório.',
        ),
      role: z
        .enum(['admin', 'user', 'dev'])
        .describe(
          'Função do usuário no sistema. Aceita apenas: admin, user ou dev. Campo obrigatório.',
        ),
      accountStatus: z
        .boolean()
        .describe(
          'Indica se a conta do usuário está ativa. Valor booleano. Campo obrigatório.',
        ),
      cpf: z
        .string()
        .regex(/^\d{11}$/, 'CPF inválido. Deve conter 11 dígitos numéricos.')
        .nullable()
        .describe(
          'CPF do usuário. Deve conter 11 dígitos numéricos. Pode ser nulo. Campo opcional.',
        ),
    }),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Autenticação com credenciais realizada com sucesso')

// Types inferidos
export type LoginUserCredentialBodyInput = z.infer<
  typeof loginUserCredentialBodySchema
>
export type LoginUserCredentialResponse = z.infer<
  typeof loginUserCredentialResponseSchema
>

// Type combinado para input
export type LoginUserCredentialInput = LoginUserCredentialBodyInput
