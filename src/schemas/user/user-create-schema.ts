// src/schemas/user/user-create-schema.ts
import {
  cpfSchema,
  emailSchema,
  fullNameSchema,
  passwordSchema,
} from '@/schemas'
import z from 'zod'

// Schema para o corpo da requisição
export const userCreateBodySchema = z.object({
  name: fullNameSchema.describe(
    'Nome completo do usuário. String com nome e sobrenome separados por espaço. Campo obrigatório.',
  ),
  email: emailSchema.describe(
    'Email do usuário para acesso ao sistema. Deve ser um endereço de email válido entre 3 e 254 caracteres. Campo obrigatório.',
  ),
  cpf: cpfSchema.describe(
    'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Pode ser nulo. Campo opcional.',
  ),
  password: passwordSchema.describe(
    'Senha do usuário para autenticação no sistema. Deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos. Campo obrigatório.',
  ),
  role: z
    .enum(['admin', 'user', 'dev'])
    .default('user')
    .describe(
      'Função do usuário no sistema. Aceita apenas: admin, user ou dev. Valor padrão: user. Campo obrigatório.',
    ),
})

// Schema para validar a resposta
export const userCreateResponseSchema = z
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
        .describe(
          'Nome completo do usuário com nome e sobrenome. Campo obrigatório.',
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
          'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Campo opcional.',
        ),
    }),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação de criação do usuário. Campo obrigatório.',
      ),
  })
  .describe('Detalhes do usuário criado com sucesso')

// Types inferidos
export type UserCreateBodyInput = z.infer<typeof userCreateBodySchema>
export type UserCreateResponse = z.infer<typeof userCreateResponseSchema>

// Type combinado para input
export type UserCreateInput = UserCreateBodyInput
