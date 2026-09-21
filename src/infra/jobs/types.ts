// src/infra/jobs/types.ts

import { FastifyBaseLogger } from 'fastify'

/**
 * Resultado que todo handler de job devolve.
 *
 * `partial` é para o job que não terminou dentro do orçamento de tempo e pode
 * continuar de onde parou: o reconciliador redispara e o que sobrou continua
 * elegível. Erro **não** volta como resultado — ele sobe, e quem registra a
 * falha no ledger é a rota interna. Job que falha em silêncio é o defeito que
 * esta mudança existe para acabar.
 */
export interface JobResult {
  status: 'succeeded' | 'partial'
  stats: Record<string, unknown>
}

export interface JobContext {
  log: FastifyBaseLogger

  /**
   * Epoch em milissegundos. Passado esse instante, o handler deve parar numa
   * fronteira segura e devolver `partial`.
   *
   * O prazo é `min(JOBS_TIME_BUDGET_MS, timeoutMs - 10s)`: o teto da plataforma
   * vem da variável de ambiente, porque depende do plano da Vercel; o teto do
   * job vem do banco, que é quem também arma o watchdog. Tomar o menor dos dois
   * é o que impede o watchdog de matar uma execução viva (RB-7 da spec 02).
   */
  deadlineAt: number

  isPastDeadline(): boolean
}

export type JobHandler = (ctx: JobContext) => Promise<JobResult>
