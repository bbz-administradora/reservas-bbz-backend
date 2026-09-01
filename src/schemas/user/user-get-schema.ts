// src/schemas/user/user-get-schema.ts
import z from 'zod'

export const userGetParamsSchema = z.object({
  id: z
    .string()
    .uuid('ID de usuário inválido')
    .describe(
      'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
    ),
})

export const userGetResponseSchema = z
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
          'Nome completo do usuário com nome e sobrenome. Pode ser nulo. Campo obrigatório.',
        ),
      email: z
        .string()
        .email()
        .describe(
          'Email do usuário para acesso ao sistema. Endereço de email válido. Campo obrigatório.',
        ),
      role: z
        .enum(['admin', 'user', 'dev'])
        .describe(
          'Função do usuário no sistema. Aceita apenas: admin, user ou dev. Campo obrigatório.',
        ),
      accountStatus: z
        .boolean()
        .describe(
          'Indica se a conta do usuário está ativa no sistema. Valor booleano. Campo obrigatório.',
        ),
      cpf: z
        .string()
        .regex(/^\d{11}$/, 'CPF inválido. Deve conter 11 dígitos numéricos.')
        .nullable()
        .describe(
          'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Pode ser nulo. Campo opcional.',
        ),
    }),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação de consulta do usuário. Campo obrigatório.',
      ),
  })
  .describe('Detalhes do usuário recuperados com sucesso')

// Types inferidos
export type UserGetParamsInput = z.infer<typeof userGetParamsSchema>
export type UserGetResponse = z.infer<typeof userGetResponseSchema>

// Type combinado para input
export type UserGetInput = UserGetParamsInput
