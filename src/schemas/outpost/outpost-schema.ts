// src/schemas/outpost/outpost-schema.ts

import z from 'zod'

// =============================================================================
// SCHEMAS BASE
// =============================================================================

/**
 * Schema de um posto avançado (resposta)
 */
export const outpostSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  clientName: z.string(),
  clientAddress: z.string(),
  startDate: z.string().describe('Data de início (YYYY-MM-DD)'),
  endDate: z.string().nullable().describe('Data fim (YYYY-MM-DD) ou null'),
  weekdays: z.array(z.number().min(0).max(6)).describe('Dias da semana [0-6]'),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * Schema de posto avançado com dados do usuário
 */
export const outpostWithUserSchema = outpostSchema.extend({
  userName: z.string().nullable(),
  userEmail: z.string().email(),
  userPosition: z.string().nullable(),
})

// =============================================================================
// CREATE
// =============================================================================

export const outpostCreateBodySchema = z.object({
  userId: z.string().uuid({ message: 'ID do usuário inválido' }),
  clientName: z
    .string()
    .min(2, 'Nome do cliente deve ter pelo menos 2 caracteres')
    .max(255, 'Nome do cliente deve ter no máximo 255 caracteres'),
  clientAddress: z.string().min(5, 'Endereço deve ter pelo menos 5 caracteres'),
  startDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Data de início deve estar no formato YYYY-MM-DD',
    ),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data fim deve estar no formato YYYY-MM-DD')
    .nullable()
    .optional(),
  weekdays: z
    .array(z.number().min(0).max(6))
    .min(1, 'Selecione pelo menos um dia da semana'),
})

export const outpostCreateResponseSchema = z.object({
  message: z.string(),
  outpost: outpostSchema,
})

export type OutpostCreateBody = z.infer<typeof outpostCreateBodySchema>
export type OutpostCreateResponse = z.infer<typeof outpostCreateResponseSchema>

// =============================================================================
// LIST
// =============================================================================

export const outpostListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'ended', 'all']).optional().default('active'),
  search: z.string().optional(),
})

export const outpostListResponseSchema = z.object({
  outposts: z.array(outpostWithUserSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
})

export type OutpostListQuery = z.infer<typeof outpostListQuerySchema>
export type OutpostListResponse = z.infer<typeof outpostListResponseSchema>

// =============================================================================
// GET BY ID
// =============================================================================

export const outpostGetParamsSchema = z.object({
  id: z.string().uuid({ message: 'ID do posto avançado inválido' }),
})

export const outpostGetResponseSchema = z.object({
  outpost: outpostWithUserSchema,
})

export type OutpostGetParams = z.infer<typeof outpostGetParamsSchema>
export type OutpostGetResponse = z.infer<typeof outpostGetResponseSchema>

// =============================================================================
// UPDATE
// =============================================================================

export const outpostUpdateParamsSchema = z.object({
  id: z.string().uuid({ message: 'ID do posto avançado inválido' }),
})

export const outpostUpdateBodySchema = z.object({
  clientName: z
    .string()
    .min(2, 'Nome do cliente deve ter pelo menos 2 caracteres')
    .max(255, 'Nome do cliente deve ter no máximo 255 caracteres')
    .optional(),
  clientAddress: z
    .string()
    .min(5, 'Endereço deve ter pelo menos 5 caracteres')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data fim deve estar no formato YYYY-MM-DD')
    .nullable()
    .optional(),
  weekdays: z
    .array(z.number().min(0).max(6))
    .min(1, 'Selecione pelo menos um dia da semana')
    .optional(),
})

export const outpostUpdateResponseSchema = z.object({
  message: z.string(),
  outpost: outpostSchema,
})

export type OutpostUpdateParams = z.infer<typeof outpostUpdateParamsSchema>
export type OutpostUpdateBody = z.infer<typeof outpostUpdateBodySchema>
export type OutpostUpdateResponse = z.infer<typeof outpostUpdateResponseSchema>

// =============================================================================
// DELETE (Encerrar)
// =============================================================================

export const outpostDeleteParamsSchema = z.object({
  id: z.string().uuid({ message: 'ID do posto avançado inválido' }),
})

export const outpostDeleteResponseSchema = z.object({
  message: z.string(),
  outpost: outpostSchema,
})

export type OutpostDeleteParams = z.infer<typeof outpostDeleteParamsSchema>
export type OutpostDeleteResponse = z.infer<typeof outpostDeleteResponseSchema>
