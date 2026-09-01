// src/schemas/occurrence/early-checkout-list-schema.ts
import z from 'zod'

// ========================================
// 📌 SCHEMAS DE ENTRADA
// ========================================

/**
 * Schema para validar os query params da listagem de ocorrências de early checkout
 */
export const earlyCheckoutListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .describe('Número da página para paginação. Default: 1'),
  pageSize: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .describe('Quantidade de itens por página. Default: 10. Máximo: 100'),
  status: z
    .enum(['pending', 'justified', 'dismissed', 'all'])
    .optional()
    .default('all')
    .describe(
      "Filtrar por status da ocorrência. Valores: 'pending', 'justified', 'dismissed', 'all'. Default: 'all'",
    ),
  supervisorName: z
    .string()
    .optional()
    .describe('Busca parcial por nome do supervisor do colaborador'),
  userName: z
    .string()
    .optional()
    .describe('Busca parcial por nome do colaborador'),
  userEmail: z
    .string()
    .optional()
    .describe('Busca parcial por email do colaborador'),
  position: z
    .enum(['manager', 'assistant_manager', 'assistant'])
    .optional()
    .describe(
      "Filtrar por cargo do colaborador. Valores: 'manager', 'assistant_manager', 'assistant'",
    ),
})

// ========================================
// 📌 SCHEMAS DE RESPOSTA
// ========================================

/**
 * Schema de uma ocorrência individual
 */
export const earlyCheckoutOccurrenceSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe('ID único do registro de checkout no formato UUID v4'),
  userId: z.string().uuid().describe('ID do colaborador'),
  userName: z.string().nullable().describe('Nome do colaborador'),
  userEmail: z.string().email().describe('Email do colaborador'),
  userAvatar: z.string().nullable().describe('URL do avatar do colaborador'),
  position: z
    .enum([
      'director',
      'supervisor',
      'manager',
      'assistant_manager',
      'assistant',
    ])
    .nullable()
    .describe('Cargo do colaborador na equipe'),
  supervisorId: z
    .string()
    .uuid()
    .nullable()
    .describe('ID do supervisor direto'),
  supervisorName: z.string().nullable().describe('Nome do supervisor direto'),
  supervisorEmail: z.string().nullable().describe('Email do supervisor direto'),
  checkInAt: z.string().describe('Data/hora do check-in no formato ISO 8601'),
  checkOutAt: z.string().describe('Data/hora do checkout no formato ISO 8601'),
  workedHours: z
    .number()
    .describe('Horas trabalhadas entre check-in e checkout'),
  status: z
    .enum(['pending', 'justified', 'dismissed'])
    .describe('Status da ocorrência'),
  justification: z.string().nullable().describe('Texto da justificativa'),
  justifiedByName: z
    .string()
    .nullable()
    .describe('Nome de quem justificou/desconsiderou'),
  justifiedAt: z
    .string()
    .nullable()
    .describe('Data/hora da justificativa no formato ISO 8601'),
  spaceId: z.string().uuid().describe('ID do espaço (workstation)'),
  spaceName: z.string().describe('Nome do espaço'),
  reservationId: z.string().uuid().describe('ID da reserva'),
})

/**
 * Schema dos indicadores/totalizadores
 */
export const earlyCheckoutIndicatorsSchema = z.object({
  total: z.number().int().min(0).describe('Total de ocorrências no período'),
  pending: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de ocorrências pendentes'),
  justified: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de ocorrências justificadas'),
  dismissed: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de ocorrências desconsideradas'),
})

/**
 * Schema da resposta completa
 */
export const earlyCheckoutListResponseSchema = z
  .object({
    period: z
      .object({
        start: z
          .string()
          .nullable()
          .describe(
            'Data da ocorrência mais antiga (pendência mais antiga) no formato ISO 8601',
          ),
        end: z.string().describe('Data atual no formato ISO 8601'),
      })
      .describe('Período consultado'),
    indicators: earlyCheckoutIndicatorsSchema.describe(
      'Indicadores/totalizadores das ocorrências',
    ),
    occurrences: z
      .array(earlyCheckoutOccurrenceSchema)
      .describe('Lista paginada de ocorrências'),
    pagination: z
      .object({
        page: z.number().int().min(1).describe('Página atual'),
        pageSize: z.number().int().min(1).describe('Itens por página'),
        totalItems: z.number().int().min(0).describe('Total de itens'),
        totalPages: z.number().int().min(0).describe('Total de páginas'),
      })
      .describe('Informações de paginação'),
    message: z.string().describe('Mensagem informativa sobre a operação'),
  })
  .describe('Listagem de ocorrências de checkout antecipado')

// ========================================
// 📌 TIPOS INFERIDOS
// ========================================

export type EarlyCheckoutListQueryInput = z.infer<
  typeof earlyCheckoutListQuerySchema
>
export type EarlyCheckoutOccurrence = z.infer<
  typeof earlyCheckoutOccurrenceSchema
>
export type EarlyCheckoutIndicators = z.infer<
  typeof earlyCheckoutIndicatorsSchema
>
export type EarlyCheckoutListResponse = z.infer<
  typeof earlyCheckoutListResponseSchema
>
