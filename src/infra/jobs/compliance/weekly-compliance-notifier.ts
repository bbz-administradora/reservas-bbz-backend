// src/infra/jobs/compliance/weekly-compliance-notifier.ts

import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { getNextWeekRange } from '@/utils/date-utils'
import { sendEmail } from '@/utils/email'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { JobContext, JobResult } from '../types'

// Repositórios
const spaceReservationRepository = new PgSpaceReservationRepository()
const teamPositionsRepository = new PgTeamPositionsRepository()

// Controle de taxa de envio
const EMAILS_PER_SECOND = 5

interface TeamMember {
  userName: string
  position: string
  requiredDays: number
  reservedDays: number
  missingDays: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 📧 QUARTA-FEIRA: lembrete para todos os colaboradores não-compliant.
 *
 * Agendado às 05:00 UTC de quarta (02:00 em São Paulo). Um único e-mail, com
 * todos em cópia oculta, lembrando que hoje é o último dia para reservar
 * workstation para a próxima semana.
 */
export async function runWednesdayComplianceReminder(
  ctx: JobContext,
): Promise<JobResult> {
  const { startDate, endDate } = getNextWeekRange()

  const nextWeekStart = format(startDate, 'dd/MM/yyyy', { locale: ptBR })
  const nextWeekEnd = format(endDate, 'dd/MM/yyyy', { locale: ptBR })
  const deadlineDay = 'quarta-feira'

  const allMembers = await spaceReservationRepository.listNonCompliantUsers(
    startDate,
    endDate,
  )

  const nonCompliantMembers = allMembers.filter((m) => !m.isCompliant)

  if (nonCompliantMembers.length === 0) {
    ctx.log.info(
      '✅ Todos os colaboradores já cumpriram o compliance. Nenhum e-mail enviado.',
    )
    return {
      status: 'succeeded',
      stats: { members: allMembers.length, nonCompliant: 0, emailsSent: 0 },
    }
  }

  const bccEmails = nonCompliantMembers.map((m) => m.userEmail).join(', ')

  ctx.log.info(
    `📧 Enviando lembrete único para ${nonCompliantMembers.length} colaboradores em BCC...`,
  )

  await sendEmail({
    type: 'WEEKLY_COMPLIANCE_REMINDER',
    to: 'noreply@bbz-gestao.com.br', // Destinatário principal (não aparece)
    bcc: bccEmails, // Todos em cópia oculta
    data: {
      nextWeekStart,
      nextWeekEnd,
      deadlineDay,
    },
  })

  return {
    status: 'succeeded',
    stats: {
      members: allMembers.length,
      nonCompliant: nonCompliantMembers.length,
      emailsSent: 1,
    },
  }
}

/**
 * 📊 SEXTA-FEIRA: relatório para supervisores e diretores.
 *
 * Agendado às 05:00 UTC de sexta (02:00 em São Paulo). Supervisores recebem os
 * pendentes da própria equipe; diretores, o consolidado por supervisor.
 *
 * Falha de envio a um destinatário não derruba o lote: ela entra em `failed` e
 * o job segue para o próximo.
 */
export async function runFridayComplianceReport(
  ctx: JobContext,
): Promise<JobResult> {
  const { startDate, endDate } = getNextWeekRange()

  const nextWeekStart = format(startDate, 'dd/MM/yyyy', { locale: ptBR })
  const nextWeekEnd = format(endDate, 'dd/MM/yyyy', { locale: ptBR })

  const allMembers = await spaceReservationRepository.listNonCompliantUsers(
    startDate,
    endDate,
  )

  const compliantCount = allMembers.filter((m) => m.isCompliant).length
  const nonCompliantCount = allMembers.filter((m) => !m.isCompliant).length

  ctx.log.info(
    `📊 Status geral: ${compliantCount} compliant, ${nonCompliantCount} não-compliant`,
  )

  if (nonCompliantCount === 0) {
    ctx.log.info(
      '✅ Todos os colaboradores cumpriram o compliance. Nenhum relatório enviado.',
    )
    return {
      status: 'succeeded',
      stats: {
        members: allMembers.length,
        nonCompliant: 0,
        supervisorEmails: 0,
        directorEmails: 0,
        failed: 0,
      },
    }
  }

  const stats = {
    members: allMembers.length,
    nonCompliant: nonCompliantCount,
    supervisorEmails: 0,
    supervisorsSkipped: 0,
    directorEmails: 0,
    failed: 0,
  }

  let emailIndex = 0

  // 📧 1. SUPERVISORES
  const supervisors = await teamPositionsRepository.listByPosition('supervisor')

  ctx.log.info(
    `📧 Enviando relatório para ${supervisors.length} supervisores...`,
  )

  for (const supervisor of supervisors) {
    try {
      if (emailIndex > 0) {
        await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
      }
      emailIndex++

      const teamMembers =
        await spaceReservationRepository.listNonCompliantUsers(
          startDate,
          endDate,
          supervisor.id, // positionId do supervisor
        )

      const teamCompliantCount = teamMembers.filter((m) => m.isCompliant).length
      const teamNonCompliantCount = teamMembers.filter(
        (m) => !m.isCompliant,
      ).length

      if (teamNonCompliantCount === 0) {
        ctx.log.info(
          `   ⏭️ ${supervisor.userName}: equipe 100% compliant, e-mail pulado`,
        )
        stats.supervisorsSkipped++
        continue
      }

      const nonCompliantTeamMembers: TeamMember[] = teamMembers
        .filter((m) => !m.isCompliant)
        .map((m) => ({
          userName: m.userName || 'Sem nome',
          position: m.position,
          requiredDays: m.requiredDays,
          reservedDays: m.reservedDays,
          missingDays: Math.max(0, m.requiredDays - m.reservedDays),
        }))

      await sendEmail({
        type: 'SUPERVISOR_COMPLIANCE_ALERT',
        to: supervisor.userEmail,
        data: {
          supervisorName: supervisor.userName || 'Supervisor',
          nextWeekStart,
          nextWeekEnd,
          totalMembers: teamMembers.length,
          compliantCount: teamCompliantCount,
          nonCompliantCount: teamNonCompliantCount,
          nonCompliantMembers: nonCompliantTeamMembers,
        },
      })

      stats.supervisorEmails++
      ctx.log.info(
        `   ✅ Supervisor ${supervisor.userName}: ${teamNonCompliantCount} pendentes`,
      )
    } catch (error) {
      stats.failed++
      ctx.log.error(
        { err: error },
        `   ❌ Erro ao enviar para supervisor ${supervisor.userEmail}`,
      )
    }
  }

  // 📧 2. DIRETORES
  const directors = await teamPositionsRepository.listByPosition('director')

  ctx.log.info(`📧 Enviando relatório para ${directors.length} diretores...`)

  for (const director of directors) {
    try {
      if (emailIndex > 0) {
        await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
      }
      emailIndex++

      // Consolidado por supervisor.
      const supervisorsSummaryMap = new Map<
        string,
        {
          supervisorName: string
          totalMembers: number
          compliantCount: number
          nonCompliantCount: number
          nonCompliantMembers: TeamMember[]
        }
      >()

      for (const member of allMembers) {
        const supName = member.supervisorName || 'Sem supervisor'

        if (!supervisorsSummaryMap.has(supName)) {
          supervisorsSummaryMap.set(supName, {
            supervisorName: supName,
            totalMembers: 0,
            compliantCount: 0,
            nonCompliantCount: 0,
            nonCompliantMembers: [],
          })
        }

        const summary = supervisorsSummaryMap.get(supName)!
        summary.totalMembers++

        if (member.isCompliant) {
          summary.compliantCount++
        } else {
          summary.nonCompliantCount++
          summary.nonCompliantMembers.push({
            userName: member.userName || 'Sem nome',
            position: member.position,
            requiredDays: member.requiredDays,
            reservedDays: member.reservedDays,
            missingDays: Math.max(0, member.requiredDays - member.reservedDays),
          })
        }
      }

      const supervisorsSummary = Array.from(supervisorsSummaryMap.values())
        .filter((s) => s.nonCompliantCount > 0)
        .sort((a, b) => b.nonCompliantCount - a.nonCompliantCount)

      await sendEmail({
        type: 'DIRECTOR_COMPLIANCE_ALERT',
        to: director.userEmail,
        data: {
          directorName: director.userName || 'Diretor',
          nextWeekStart,
          nextWeekEnd,
          totalMembers: allMembers.length,
          compliantCount,
          nonCompliantCount,
          supervisorsSummary,
        },
      })

      stats.directorEmails++
      ctx.log.info(
        `   ✅ Diretor ${director.userName}: relatório consolidado enviado`,
      )
    } catch (error) {
      stats.failed++
      ctx.log.error(
        { err: error },
        `   ❌ Erro ao enviar para diretor ${director.userEmail}`,
      )
    }
  }

  return { status: 'succeeded', stats }
}
