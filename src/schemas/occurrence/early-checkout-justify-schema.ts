// src/schemas/occurrence/early-checkout-justify-schema.ts
import z from 'zod'

// ========================================
// 📌 SCHEMAS DE ENTRADA
// ========================================

/**
 * Schema para validar os params da rota de justificativa
 */
export const earlyCheckoutJustifyParamsSchema = z.object({
  id: z
    .string()
    .uuid({ message: 'ID da ocorrência inválido. Deve ser um UUID válido.' })
    .describe('ID do registro de checkout antecipado (UUID)'),
})

/**
 * Schema para validar o body da justificativa de early checkout
 */
export const earlyCheckoutJustifyBodySchema = z
  .object({
    action: z
      .enum(['justified', 'dismissed'], {
        errorMap: () => ({
          message:
            "Ação inválida. Use 'justified' para justificar ou 'dismissed' para descartar.",
        }),
      })
      .describe(
        "Ação a ser tomada: 'justified' (justificar) ou 'dismissed' (descartar)",
      ),
    justification: z
      .string()
      .min(10, {
        message: 'A justificativa deve ter no mínimo 10 caracteres.',
      })
      .max(1000, {
        message: 'A justificativa deve ter no máximo 1000 caracteres.',
      })
      .optional()
      .describe(
        "Texto da justificativa (obrigatório quando action = 'justified')",
      ),
  })
  .refine(
    (data) => {
      // Se a ação for 'justified', a justificativa é obrigatória
      if (data.action === 'justified') {
        return (
          data.justification !== undefined && data.justification.length >= 10
        )
      }
      return true
    },
    {
      message:
        "A justificativa é obrigatória quando a ação é 'justified' e deve ter no mínimo 10 caracteres.",
      path: ['justification'],
    },
  )

// ========================================
// 📌 SCHEMAS DE RESPOSTA
// ========================================

/**
 * Schema da resposta de sucesso
 */
export const earlyCheckoutJustifyResponseSchema = z.object({
  occurrence: z.object({
    id: z.string().uuid().describe('ID do registro'),
    userId: z.string().uuid().describe('ID do colaborador'),
    userName: z.string().nullable().describe('Nome do colaborador'),
    status: z
      .enum(['pending', 'justified', 'dismissed'])
      .describe('Novo status da ocorrência'),
    justification: z.string().nullable().describe('Texto da justificativa'),
    justifiedByName: z
      .string()
      .nullable()
      .describe('Nome de quem justificou/descartou'),
    justifiedAt: z
      .string()
      .nullable()
      .describe('Data/hora da justificativa no formato ISO 8601'),
  }),
  message: z.string().describe('Mensagem de sucesso'),
})

// ========================================
// 📌 TIPOS INFERIDOS
// ========================================

export type EarlyCheckoutJustifyParamsInput = z.infer<
  typeof earlyCheckoutJustifyParamsSchema
>
export type EarlyCheckoutJustifyBodyInput = z.infer<
  typeof earlyCheckoutJustifyBodySchema
>
export type EarlyCheckoutJustifyResponse = z.infer<
  typeof earlyCheckoutJustifyResponseSchema
>
