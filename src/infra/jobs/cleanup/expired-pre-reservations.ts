import { FastifyInstance } from 'fastify'
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { database } from '../../database'

/**
 * Task para limpar pré-reservas expiradas
 *
 * OTIMIZAÇÃO: Agora roda a cada 30 minutos (antes era 1 minuto)
 * As queries de disponibilidade já ignoram pré-reservas expiradas via filtro SQL,
 * então esse job serve apenas para limpeza de dados, não impactando a UX.
 */
function createCleanupExpiredPreReservationsTask(app: FastifyInstance) {
  return new AsyncTask(
    'cleanup-expired-pre-reservations',
    async () => {
      try {
        const result = await database.query({
          text: `
            DELETE FROM space_slots
            WHERE status = 'pre_reserved'
            AND pre_reserved_until < NOW()
            RETURNING id
          `,
        })

        const deletedCount = result.rowCount || 0
        if (deletedCount > 0) {
          app.log.info(
            `🧹 Limpeza: ${deletedCount} pré-reservas expiradas foram removidas`,
          )
        }
      } catch (error) {
        app.log.error(
          { err: error },
          '❌ Erro ao limpar pré-reservas expiradas',
        )
      }
    },
    (err) => {
      app.log.error(
        { err },
        '❌ Erro na execução do job de limpeza de pré-reservas',
      )
    },
  )
}

/**
 * Cria o job de limpeza de pré-reservas expiradas
 * Executa a cada 30 minutos
 *
 * OTIMIZAÇÃO: Reduzido de 1 minuto para 30 minutos (redução de ~97% das execuções)
 * As queries de disponibilidade já ignoram slots expirados via filtro SQL,
 * então a limpeza é apenas para manter o banco organizado, não impacta UX.
 */
export function createExpiredPreReservationsCleanupJob(app: FastifyInstance) {
  return new SimpleIntervalJob(
    { minutes: 30, runImmediately: false },
    createCleanupExpiredPreReservationsTask(app),
  )
}
