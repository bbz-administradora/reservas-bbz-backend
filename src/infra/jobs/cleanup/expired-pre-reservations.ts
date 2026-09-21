import { database } from '../../database'
import { JobContext, JobResult } from '../types'

/**
 * Limpeza de pré-reservas expiradas.
 *
 * Agendado pelo pg_cron a cada 30 minutos, alinhado ao relógio de parede: roda
 * em :00 e :30. Antes era um intervalo contado a partir do boot do processo, o
 * que na Vercel significava "quando alguma instância estiver acordada há meia
 * hora" — ou seja, quase nunca de madrugada.
 *
 * A limpeza é higiene: as queries de disponibilidade já ignoram pré-reserva
 * expirada por filtro SQL, então atrasar uma execução não afeta a experiência.
 */
export async function runCleanupExpiredPreReservations(
  ctx: JobContext,
): Promise<JobResult> {
  const result = await database.query({
    text: `
      DELETE FROM space_slots
      WHERE status = 'pre_reserved'
      AND pre_reserved_until < NOW()
      RETURNING id
    `,
  })

  const deleted = result.rowCount || 0

  if (deleted > 0) {
    ctx.log.info(
      `🧹 Limpeza: ${deleted} pré-reservas expiradas foram removidas`,
    )
  }

  return { status: 'succeeded', stats: { deleted } }
}
