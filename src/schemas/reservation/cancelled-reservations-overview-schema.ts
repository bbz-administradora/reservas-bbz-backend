// src/schemas/reservation/cancelled-reservations-overview-schema.ts
import z from 'zod'

/**
 * Schema para query params do endpoint de overview de cancelamentos
 */
export const cancelledReservationsOverviewQuerySchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe(
      'Data inicial do período de busca (ISO 8601). Se não informado, busca do início do mês atual.',
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      'Data final do período de busca (ISO 8601). Se não informado, busca até o momento atual.',
    ),
})

export type CancelledReservationsOverviewQuery = z.infer<
  typeof cancelledReservationsOverviewQuerySchema
>

/**
 * Schema para resposta do endpoint de overview de cancelamentos
 *
 * - Supervisor: vê apenas cancelamentos da sua equipe
 * - Diretor: vê todos os cancelamentos
 * - Colaborador: não tem acesso a esse endpoint
 */
export const cancelledReservationsOverviewResponseSchema = z.object({
  userType: z
    .enum(['supervisor', 'director'])
    .describe('Tipo de usuário que está consultando (supervisor ou diretor).'),
  totalCancellations: z
    .number()
    .int()
    .min(0)
    .describe('Total de cancelamentos após o prazo de planejamento.'),
  periodStart: z
    .string()
    .describe('Data de início do período consultado (ISO 8601).'),
  periodEnd: z
    .string()
    .describe('Data de fim do período consultado (ISO 8601).'),
})

export type CancelledReservationsOverviewResponse = z.infer<
  typeof cancelledReservationsOverviewResponseSchema
>
