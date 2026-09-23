// src/infra/jobs/runner.ts

import { env } from '@/infra/env'
import { FastifyBaseLogger } from 'fastify'
import { JobName, jobRegistry } from './registry'
import { JobContext, JobResult } from './types'

/** Folga entre o prazo do handler e o instante em que o watchdog desiste. */
const FOLGA_ATE_O_WATCHDOG_MS = 10_000

interface ExecutarJobParams {
  name: JobName
  log: FastifyBaseLogger

  /**
   * Teto que o pg_cron mandou, vindo de `jobs.job_definition.timeout_ms`.
   * Ausente em execução local pelo CLI, onde só vale o teto da plataforma.
   */
  timeoutMs?: number
}

/**
 * Executa um job e devolve o resultado, sem saber quem pediu.
 *
 * A rota interna e o CLI local passam por aqui, então os dois enxergam
 * exatamente o mesmo comportamento — inclusive o prazo.
 *
 * O prazo é o menor entre o teto da plataforma (`JOBS_TIME_BUDGET_MS`, que
 * depende do plano da Vercel) e o teto do job menos folga (que é o mesmo número
 * com que o watchdog o considera travado). Tomar o menor é o que garante que
 * nenhuma execução viva seja marcada como falha e redisparada.
 */
export async function executarJob({
  name,
  log,
  timeoutMs,
}: ExecutarJobParams): Promise<JobResult> {
  const tetoDoJob = timeoutMs
    ? timeoutMs - FOLGA_ATE_O_WATCHDOG_MS
    : Number.POSITIVE_INFINITY

  const orcamento = Math.max(
    1_000,
    Math.min(env.JOBS_TIME_BUDGET_MS, tetoDoJob),
  )

  const deadlineAt = Date.now() + orcamento

  const ctx: JobContext = {
    log,
    deadlineAt,
    isPastDeadline: () => Date.now() >= deadlineAt,
  }

  const inicio = Date.now()
  log.info(`🏁 Job ${name} iniciado (orçamento de ${orcamento} ms)`)

  const resultado = await jobRegistry[name].handler(ctx)

  log.info(
    { stats: resultado.stats },
    `✅ Job ${name} terminou como ${resultado.status} em ${Date.now() - inicio} ms`,
  )

  return resultado
}
