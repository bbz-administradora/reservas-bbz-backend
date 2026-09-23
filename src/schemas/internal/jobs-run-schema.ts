// src/schemas/internal/jobs-run-schema.ts

import z from 'zod'

export const jobsRunParamsSchema = z.object({
  name: z.string().min(1),
})

/**
 * Corpo que o `jobs.trigger_http` monta no banco.
 *
 * Tudo opcional porque a execução local pelo CLI não passa por aqui e um
 * disparo manual de teste pode vir sem ledger. Em produção, a ausência de
 * `runId` é recusada pelo controller.
 */
export const jobsRunBodySchema = z.object({
  job: z.string().optional(),
  runId: z.coerce.number().int().positive().optional(),
  scheduledFor: z.string().optional(),
  timeoutMs: z.coerce.number().int().positive().optional(),
})

export const jobsRunResponseSchema = z.object({
  job: z.string(),
  runId: z.number().nullable(),
  status: z.enum(['succeeded', 'partial']),
  durationMs: z.number(),
  stats: z.record(z.unknown()),
})
