import { database } from '../../database'
import { JobContext, JobResult } from '../types'

/**
 * Limpeza diária de slots reservados de datas passadas.
 *
 * Agendado às 05:50 UTC pelo pg_cron, que é 02:50 em São Paulo — o mesmo
 * horário de antes. `CURRENT_DATE` continua sendo avaliado em UTC, que é o fuso
 * da sessão nos dois ambientes: esta mudança troca o relógio, não a semântica.
 */
export async function runCleanupExpiredReservations(
  ctx: JobContext,
): Promise<JobResult> {
  const result = await database.query({
    text: `
      DELETE FROM space_slots
      WHERE status = 'reserved'
      AND (upper(slot_range))::date < CURRENT_DATE
      RETURNING id
    `,
  })

  const deleted = result.rowCount || 0

  if (deleted > 0) {
    ctx.log.info(
      `🧹 Limpeza diária: ${deleted} reservas expiradas foram removidas`,
    )
  }

  return { status: 'succeeded', stats: { deleted } }
}
