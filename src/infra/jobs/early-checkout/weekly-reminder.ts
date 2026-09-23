// src/infra/jobs/early-checkout/weekly-reminder.ts

import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { sendEmail } from '@/utils/email'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { JobContext, JobResult } from '../types'

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 📧 SEGUNDA-FEIRA: pendências de checkout antecipado para cada supervisor.
 *
 * Agendado às 05:10 UTC de segunda (02:10 em São Paulo). Supervisor sem
 * pendência na equipe não recebe e-mail.
 *
 * Falha com um supervisor não derruba o lote: entra em `failed` e o job segue.
 */
export async function runMondayEarlyCheckoutReminder(
  ctx: JobContext,
): Promise<JobResult> {
  const supervisors = await teamPositionsRepository.listByPosition('supervisor')

  ctx.log.info(`📧 Verificando ${supervisors.length} supervisores...`)

  const stats = {
    supervisors: supervisors.length,
    emailsSent: 0,
    skipped: 0,
    failed: 0,
  }

  let emailIndex = 0

  for (const supervisor of supervisors) {
    try {
      if (emailIndex > 0) {
        await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
      }
      emailIndex++

      const teamUserIds =
        await spaceCheckInOutRepository.getTeamUserIdsBySupervisor(
          supervisor.userId,
        )

      if (teamUserIds.length === 0) {
        ctx.log.info(`   ⏭️ ${supervisor.userName}: sem membros na equipe`)
        stats.skipped++
        continue
      }

      const oldestPendingDate =
        await spaceCheckInOutRepository.getOldestPendingEarlyCheckoutDate(
          teamUserIds,
        )

      if (!oldestPendingDate) {
        ctx.log.info(`   ⏭️ ${supervisor.userName}: sem pendências`)
        stats.skipped++
        continue
      }

      const indicators =
        await spaceCheckInOutRepository.getEarlyCheckoutIndicators({
          status: 'pending',
          teamUserIds,
        })

      if (indicators.pending === 0) {
        ctx.log.info(`   ⏭️ ${supervisor.userName}: sem pendências`)
        stats.skipped++
        continue
      }

      const { occurrences } =
        await spaceCheckInOutRepository.listEarlyCheckoutOccurrences({
          status: 'pending',
          teamUserIds,
          page: 1,
          pageSize: 1000, // Busca todas
        })

      const periodStart = format(oldestPendingDate, 'dd/MM/yyyy', {
        locale: ptBR,
      })
      const periodEnd = format(new Date(), 'dd/MM/yyyy', { locale: ptBR })

      const pendingOccurrences: EarlyCheckoutOccurrence[] = occurrences.map(
        (o) => ({
          userName: o.userName || 'Sem nome',
          position: o.position || 'assistant',
          checkoutDate: format(new Date(o.checkOutAt), 'dd/MM/yyyy', {
            locale: ptBR,
          }),
          workedHours: o.workedHours,
        }),
      )

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

      stats.emailsSent++
      ctx.log.info(
        `   ✅ Supervisor ${supervisor.userName}: ${indicators.pending} pendência(s)`,
      )
    } catch (error) {
      stats.failed++
      ctx.log.error(
        { err: error },
        `   ❌ Erro ao processar supervisor ${supervisor.userEmail}`,
      )
    }
  }

  ctx.log.info(`📊 Job finalizado: ${stats.emailsSent} e-mail(s) enviado(s)`)

  return { status: 'succeeded', stats }
}
