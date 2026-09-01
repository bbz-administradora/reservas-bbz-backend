// src/schemas/team/positions/update-supervisor-schema.ts
import z from 'zod'

/**
 * Schema para validar os parâmetros da URL para atualizar o supervisor de uma posição
 */
export const updateSupervisorParamsSchema = z.object({
  userId: z
    .string()
    .uuid('ID de usuário inválido. Deve ser um UUID válido.')
    .describe(
      'Identificador único do usuário que terá seu supervisor atualizado no formato UUID v4. Campo obrigatório.',
    ),
})

/**
 * Schema para validar o corpo da requisição de atualização de supervisor
 */
export const updateSupervisorBodySchema = z.object({
  supervisorEmail: z
    .string()
    .email('Email do supervisor deve ser um email válido.')
    .describe(
      'Email do usuário que será definido como chefe imediato (supervisor, gerente ou subgerente). Campo obrigatório.',
    ),
})

/**
 * Schema para validar a resposta de sucesso da atualização de supervisor
 */
export const updateSupervisorResponseSchema = z
  .object({
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
    userId: z
      .string()
      .uuid()
      .describe(
        'Identificador único do usuário que teve seu supervisor atualizado. Campo obrigatório.',
      ),
    supervisorUserId: z
      .string()
      .uuid()
      .describe(
        'Identificador único do usuário que foi definido como chefe imediato. Campo obrigatório.',
      ),
    supervisorEmail: z
      .string()
      .email()
      .describe(
        'Email do usuário que foi definido como chefe imediato. Campo obrigatório.',
      ),
    supervisorName: z
      .string()
      .nullable()
      .describe('Nome do usuário que foi definido como chefe imediato.'),
    supervisorPosition: z
      .string()
      .describe(
        'Posição do chefe imediato na equipe (supervisor, manager, etc.). Campo obrigatório.',
      ),
  })
  .describe('Supervisor atualizado com sucesso')

// Types inferidos
export type UpdateSupervisorParamsInput = z.infer<
  typeof updateSupervisorParamsSchema
>
export type UpdateSupervisorBodyInput = z.infer<
  typeof updateSupervisorBodySchema
>
export type UpdateSupervisorResponse = z.infer<
  typeof updateSupervisorResponseSchema
>
