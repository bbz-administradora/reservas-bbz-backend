import z from 'zod'

/**
 * Schema para resposta do endpoint user/me
 */
export const userMeResponseSchema = z
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
          'Nome completo do usuário. String de texto. Pode ser nulo. Campo obrigatório.',
        ),
      email: z
        .string()
        .email()
        .describe(
          'Endereço de email do usuário. Email válido. Campo obrigatório.',
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
          'CPF do usuário para identificação fiscal. Deve conter 11 dígitos numéricos sem pontuação. Pode ser nulo. Campo opcional.',
        ),
      teamPosition: z
        .enum([
          'director',
          'supervisor',
          'manager',
          'assistant_manager',
          'assistant',
        ])
        .nullable()
        .describe(
          'Posição do usuário na equipe de atendimento. Pode ser director, supervisor, manager, assistant_manager, assistant ou null se não faz parte da equipe. Campo obrigatório.',
        ),
      bookingExceptionUntil: z
        .string()
        .nullable()
        .describe(
          'Data/hora limite da exceção de regras de reserva em formato ISO. NULL se não há exceção ativa. Campo obrigatório.',
        ),
      absenceStartDate: z
        .string()
        .nullable()
        .describe(
          'Data de início do afastamento (YYYY-MM-DD). NULL se não há afastamento. Campo obrigatório.',
        ),
      absenceEndDate: z
        .string()
        .nullable()
        .describe(
          'Data de fim do afastamento (YYYY-MM-DD). NULL se não há afastamento. Campo obrigatório.',
        ),
    }),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Dados do usuário recuperados com sucesso')

// Type inferido para a resposta
export type UserMeResponse = z.infer<typeof userMeResponseSchema>
