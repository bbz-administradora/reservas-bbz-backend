// src/infra/jobs/early-checkout/weekly-reminder.ts

import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { sendEmail } from '@/utils/email'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FastifyInstance } from 'fastify'
import { AsyncTask, CronJob } from 'toad-scheduler'

// Repositórios
const spaceCheckInOutRepository = new PgSpaceCheckInOutRepository()
const teamPositionsRepository = new PgTeamPositionsRepository()

// Controle de taxa de envio
const EMAILS_PER_SECOND = 5

interface EarlyCheckoutOccurrence {
  userName: string
  position: string
  checkoutDate: string
  workedHours: number
}

/**
 * Função auxiliar para adicionar delay entre envios
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 📧 SEGUNDA-FEIRA: Lembrete de checkout antecipado para supervisores
 *
 * Envia email para cada supervisor que tem ocorrências pendentes
 * de checkout antecipado na sua equipe.
 */
function createMondayEarlyCheckoutReminderTask(app: FastifyInstance) {
  return new AsyncTask(
    'weekly-early-checkout-monday-reminder',
    async () => {
      try {
        console.log(
          '🏁 Job de lembrete de checkout antecipado (segunda-feira) iniciado',
        )

        // Busca todos os supervisores
        const supervisors =
          await teamPositionsRepository.listByPosition('supervisor')

        console.log(`📧 Verificando ${supervisors.length} supervisores...`)

        let emailIndex = 0
        let emailsSent = 0

        for (const supervisor of supervisors) {
          try {
            // Controle de taxa de envio
            if (emailIndex > 0) {
              await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
            }
            emailIndex++

            // Busca IDs dos membros da equipe deste supervisor
            const teamUserIds =
              await spaceCheckInOutRepository.getTeamUserIdsBySupervisor(
                supervisor.userId,
              )

            if (teamUserIds.length === 0) {
              console.log(
                `   ⏭️ ${supervisor.userName}: sem membros na equipe, pulado`,
              )
              continue
            }

            // Busca a data da pendência mais antiga
            const oldestPendingDate =
              await spaceCheckInOutRepository.getOldestPendingEarlyCheckoutDate(
                teamUserIds,
              )

            // Se não tem pendências, pula este supervisor
            if (!oldestPendingDate) {
              console.log(
                `   ⏭️ ${supervisor.userName}: sem pendências, pulado`,
              )
              continue
            }

            // Busca indicadores para contar pendências
            const indicators =
              await spaceCheckInOutRepository.getEarlyCheckoutIndicators({
                status: 'pending',
                teamUserIds,
              })

            if (indicators.pending === 0) {
              console.log(
                `   ⏭️ ${supervisor.userName}: sem pendências, pulado`,
              )
              continue
            }

            // Busca as ocorrências pendentes (todas, sem paginação)
            const { occurrences } =
              await spaceCheckInOutRepository.listEarlyCheckoutOccurrences({
                status: 'pending',
                teamUserIds,
                page: 1,
                pageSize: 1000, // Busca todas
              })

            // Formata o período
            const periodStart = format(oldestPendingDate, 'dd/MM/yyyy', {
              locale: ptBR,
            })
            const periodEnd = format(new Date(), 'dd/MM/yyyy', { locale: ptBR })

            // Monta lista de ocorrências para o email
            const pendingOccurrences: EarlyCheckoutOccurrence[] =
              occurrences.map((o) => ({
                userName: o.userName || 'Sem nome',
                position: o.position || 'assistant',
                checkoutDate: format(new Date(o.checkOutAt), 'dd/MM/yyyy', {
                  locale: ptBR,
                }),
                workedHours: o.workedHours,
              }))

            await sendEmail({
              type: 'EARLY_CHECKOUT_REMINDER',
              to: supervisor.userEmail,
              data: {
                supervisorName: supervisor.userName || 'Supervisor',
                periodStart,
                periodEnd,
                pendingCount: indicators.pending,
                pendingOccurrences,
              },
            })

            emailsSent++
            console.log(
              `   ✅ Supervisor ${supervisor.userName}: ${indicators.pending} pendência(s)`,
            )
          } catch (error) {
            console.log(
              `   ❌ Erro ao processar supervisor ${supervisor.userEmail}:`,
              error,
            )
          }
        }

        console.log(`📊 Job finalizado: ${emailsSent} email(s) enviado(s)`)
      } catch (error) {
        app.log.error(
          { err: error },
          '❌ Erro no job de lembrete de checkout antecipado',
        )
      }
    },
    (err) => {
      app.log.error(
        { err },
        '❌ Erro na execução do job de lembrete de checkout antecipado',
      )
    },
  )
}

/**
 * Cria o job de lembrete de checkout antecipado
 * Executa às 02:10 da manhã de segunda-feira (horário de São Paulo)
 *
 * Cron: 0 10 2 * * 1
 * - segundos: 0
 * - minutos: 10
 * - hora: 2
 * - dia do mês: * (qualquer)
 * - mês: * (qualquer)
 * - dia da semana: 1 (segunda-feira)
 */
export function createMondayEarlyCheckoutReminderJob(app: FastifyInstance) {
  return new CronJob(
    {
      cronExpression: '0 10 2 * * 1', // Segunda às 02:10
      timezone: 'America/Sao_Paulo',
    },
    createMondayEarlyCheckoutReminderTask(app),
    {
      preventOverrun: true,
    },
  )
}
