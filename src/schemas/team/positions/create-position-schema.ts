// src/schemas/team/positions/create-position-schema.ts
import z from 'zod'
import { positionTypeSchema } from './position-type-schema'

/**
 * Schema para validar os parâmetros da URL para criação de posição
 *
 * A posição é informada via parâmetro na URL (ex: /positions/manager)
 */
export const createPositionParamsSchema = z.object({
  position: positionTypeSchema.describe(
    'Tipo da posição a ser criada. Valores válidos: director, supervisor, manager, assistant_manager, assistant. Campo obrigatório.',
  ),
})

/**
 * Schema para validar o corpo da requisição de criação de posição
 *
 * O nomeador precisa informar o email do usuário que será nomeado.
 * O sistema buscará o usuário pelo email e criará a posição.
 *
 * Para posições que precisam de vínculo hierárquico, o campo supervisorEmail
 * deve ser informado com o email do chefe imediato:
 * - manager: precisa informar o email do supervisor (chefe imediato)
 * - assistant_manager: precisa informar o email do gerente (chefe imediato)
 * - assistant: precisa informar o email do gerente ou subgerente (chefe imediato)
 */
export const createPositionBodySchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .min(3, 'Email deve ter no mínimo 3 caracteres')
    .max(254, 'Email deve ter no máximo 254 caracteres')
    .describe(
      'Email do usuário que será nomeado para a posição. Deve ser um email válido de um usuário cadastrado no sistema. Campo obrigatório.',
    ),
  supervisorEmail: z
    .string()
    .email('Email do chefe imediato inválido')
    .optional()
    .describe(
      'Email do chefe imediato do usuário que será nomeado. Obrigatório para: manager (email do supervisor), assistant_manager (email do gerente), assistant (email do gerente ou subgerente). Campo opcional para director e supervisor.',
    ),
})

/**
 * Schema para validar a resposta de sucesso da criação de posição
 */
export const createPositionResponseSchema = z
  .object({
    position: z.object({
      id: z
        .string()
        .uuid()
        .describe(
          'Identificador único da posição no formato UUID v4. Campo obrigatório.',
        ),
      userId: z
        .string()
        .uuid()
        .describe(
          'Identificador único do usuário nomeado no formato UUID v4. Campo obrigatório.',
        ),
      type: positionTypeSchema.describe(
        'Tipo da posição atribuída. Campo obrigatório.',
      ),
      level: z
        .number()
        .int()
        .min(1)
        .max(5)
        .describe('Nível hierárquico da posição (1-5). Campo obrigatório.'),
      userName: z
        .string()
        .nullable()
        .describe(
          'Nome do usuário nomeado. Pode ser nulo se não definido. Campo obrigatório.',
        ),
      userEmail: z
        .string()
        .email()
        .describe('Email do usuário nomeado. Campo obrigatório.'),
      createdAt: z
        .string()
        .describe(
          'Data e hora da nomeação no formato ISO 8601. Campo obrigatório.',
        ),
    }),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('Posição criada com sucesso')

// Types inferidos
export type CreatePositionParamsInput = z.infer<
  typeof createPositionParamsSchema
>
export type CreatePositionBodyInput = z.infer<typeof createPositionBodySchema>
export type CreatePositionResponse = z.infer<
  typeof createPositionResponseSchema
>
