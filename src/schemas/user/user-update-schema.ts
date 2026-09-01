// src/schemas/user/user-update-schema.ts
import { emailSchema, fullNameSchema } from '@/schemas'
import z from 'zod'

// Schema para validar os parâmetros da requisição
export const userUpdateParamsSchema = z.object({
  id: z
    .string()
    .uuid({ message: 'ID de usuário inválido' })
    .describe(
      'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
    ),
})

// Schema para validar o corpo da requisição
export const userUpdateBodySchema = z.object({
  name: fullNameSchema
    .optional()
    .describe(
      'Nome completo do usuário. String com nome e sobrenome. Campo opcional.',
    ),

  email: emailSchema
    .optional()
    .describe('Email do usuário. Endereço de email válido. Campo opcional.'),

  role: z
    .enum(['admin', 'user', 'dev'])
    .optional()
    .describe(
      'Função do usuário no sistema. Aceita apenas: admin, user ou dev. Campo opcional.',
    ),

  accountStatus: z
    .boolean()
    .optional()
    .describe(
      'Indica se a conta do usuário está ativa. Valor booleano. Campo opcional.',
    ),

  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF inválido. Deve conter 11 dígitos numéricos.')
    .nullable()
    .optional()
    .describe(
      'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Pode ser nulo. Campo opcional.',
    ),
})

// Schema para validar a resposta
export const userUpdateResponseSchema = z
  .object({
    user: z.object({
      id: z
        .string()
        .uuid()
        .describe(
          'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
        ),

      name: z.string().describe('Nome completo do usuário. Campo obrigatório.'),

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
          'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Pode ser nulo. Campo obrigatório.',
        ),
    }),

    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Detalhes do usuário atualizado com sucesso')

// Types inferidos
export type UserUpdateParamsInput = z.infer<typeof userUpdateParamsSchema>
export type UserUpdateBodyInput = z.infer<typeof userUpdateBodySchema>
export type UserUpdateResponse = z.infer<typeof userUpdateResponseSchema>

// Type combinado para input
export type UserUpdateInput = UserUpdateParamsInput & UserUpdateBodyInput
