import { FastifyInstance } from 'fastify'
import { AsyncTask, CronJob } from 'toad-scheduler'
import { database } from '../../database'

/**
 * Task para limpar slots reservados expirados (uma vez por dia)
 */
function createCleanupExpiredReservationsTask(app: FastifyInstance) {
  return new AsyncTask(
    'cleanup-expired-reservations',
    async () => {
      try {
        console.log('🏁 Job de limpeza de reservas expiradas iniciado')

        const result = await database.query({
          text: `
            DELETE FROM space_slots
            WHERE status = 'reserved'
            AND (upper(slot_range))::date < CURRENT_DATE
            RETURNING id
          `,
        })

        const deletedCount = result.rowCount || 0
        if (deletedCount > 0) {
          app.log.info(
            `🧹 Limpeza diária: ${deletedCount} reservas expiradas foram removidas`,
          )
        }
      } catch (error) {
        app.log.error({ err: error }, '❌ Erro ao limpar reservas expiradas')
      }
    },
    (err) => {
      app.log.error(
        { err },
        '❌ Erro na execução do job diário de limpeza de reservas',
      )
    },
  )
}

/**
 * Cria o job diário de limpeza de reservas expiradas
 * Executa às 02:50 da manhã (horário de São Paulo)
 */
export function createExpiredReservationsCleanupJob(app: FastifyInstance) {
  return new CronJob(
    {
      cronExpression: '0 50 2 * * *', // segundos, minutos, hora, dia do mês, mês, dia da semana (* = todo)
      timezone: 'America/Sao_Paulo',
    },
    createCleanupExpiredReservationsTask(app),
    {
      preventOverrun: true,
    },
  )
}
