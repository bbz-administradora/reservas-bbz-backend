// src/schemas/user/user-list-schema.ts
import z from 'zod'

// Schema para validar os parâmetros de consulta
export const userListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .describe(
      'Número da página para paginação, começando em 1. Valor padrão: 1. Campo opcional.',
    ),

  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1000))
    .describe(
      'Quantidade de registros por página. Valor padrão: 1000. Campo opcional.',
    ),

  search: z
    .string()
    .optional()
    .describe(
      'Termo de busca para filtrar usuários por nome ou email. Campo opcional.',
    ),

  role: z
    .enum(['admin', 'user', 'dev'])
    .optional()
    .describe(
      'Função do usuário no sistema para filtrar resultados. Aceita apenas: admin, user ou dev. Campo opcional.',
    ),

  accountStatus: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    })
    .describe(
      'Status da conta do usuário para filtrar resultados. Valores aceitos: "true" (ativo) ou "false" (inativo). Campo opcional.',
    ),
})

// Schema para validar a resposta
export const userListResponseSchema = z
  .object({
    users: z
      .array(
        z.object({
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
              'Nome completo do usuário. Pode ser nulo se não fornecido. Campo obrigatório.',
            ),

          email: z
            .string()
            .email()
            .describe(
              'Endereço de email do usuário. Endereço de email válido. Campo obrigatório.',
            ),

          role: z
            .enum(['admin', 'user', 'dev'])
            .describe(
              'Função do usuário no sistema. Aceita apenas: admin, user ou dev. Campo obrigatório.',
            ),

          accountStatus: z
            .boolean()
            .describe(
              'Indica se a conta do usuário está ativa (true) ou inativa (false). Campo obrigatório.',
            ),

          cpf: z
            .string()
            .regex(
              /^\d{11}$/,
              'CPF inválido. Deve conter 11 dígitos numéricos.',
            )
            .nullable()
            .describe(
              'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Pode ser nulo. Campo opcional.',
            ),

          createdAt: z
            .string()
            .describe(
              'Data e hora de criação do registro no formato ISO 8601. Campo obrigatório.',
            ),
        }),
      )
      .describe('Lista de usuários recuperados conforme os filtros aplicados.'),

    totalPages: z
      .number()
      .describe(
        'Número total de páginas disponíveis com base no tamanho da página. Campo obrigatório.',
      ),

    currentPage: z
      .number()
      .describe('Número da página atual da consulta. Campo obrigatório.'),

    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Lista de usuários recuperada com sucesso')

// Tipagens inferidas
export type UserListQueryInput = z.infer<typeof userListQuerySchema>
export type UserListResponse = z.infer<typeof userListResponseSchema>
