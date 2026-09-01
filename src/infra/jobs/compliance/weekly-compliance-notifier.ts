// src/infra/jobs/compliance/weekly-compliance-notifier.ts

import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { getNextWeekRange } from '@/utils/date-utils'
import { sendEmail } from '@/utils/email'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FastifyInstance } from 'fastify'
import { AsyncTask, CronJob } from 'toad-scheduler'

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

/**
 * Função auxiliar para adicionar delay entre envios
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 📧 QUARTA-FEIRA: Lembrete para todos os colaboradores
 *
 * Envia um único email em cópia oculta (BCC) para todos os
 * colaboradores não-compliant, lembrando que hoje é o último dia
 * para fazer reservas de workstation para a próxima semana.
 */
function createWednesdayReminderTask(app: FastifyInstance) {
  return new AsyncTask(
    'weekly-compliance-wednesday-reminder',
    async () => {
      try {
        console.log('🏁 Job de lembrete de compliance (quarta-feira) iniciado')

        const { startDate, endDate } = getNextWeekRange()

        // Formata as datas para exibição
        const nextWeekStart = format(startDate, 'dd/MM/yyyy', { locale: ptBR })
        const nextWeekEnd = format(endDate, 'dd/MM/yyyy', { locale: ptBR })
        const deadlineDay = 'quarta-feira'

        // Busca todos os colaboradores que devem cumprir compliance
        const allMembers =
          await spaceReservationRepository.listNonCompliantUsers(
            startDate,
            endDate,
          )

        // Filtra apenas os não-compliant (ainda precisam reservar)
        const nonCompliantMembers = allMembers.filter((m) => !m.isCompliant)

        if (nonCompliantMembers.length === 0) {
          console.log(
            '✅ Todos os colaboradores já cumpriram o compliance. Nenhum email enviado.',
          )
          return
        }

        // Coleta todos os emails em uma lista para BCC
        const bccEmails = nonCompliantMembers.map((m) => m.userEmail).join(', ')

        console.log(
          `📧 Enviando lembrete único para ${nonCompliantMembers.length} colaboradores em BCC...`,
        )

        try {
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

          console.log(
            `✅ Email enviado com sucesso para ${nonCompliantMembers.length} destinatários`,
          )
        } catch (error) {
          console.log('❌ Erro ao enviar email de lembrete:', error)
        }
      } catch (error) {
        app.log.error(
          { err: error },
          '❌ Erro no job de lembrete de compliance',
        )
      }
    },
    (err) => {
      app.log.error(
        { err },
        '❌ Erro na execução do job de lembrete de compliance',
      )
    },
  )
}

/**
 * 📊 SEXTA-FEIRA: Relatório para supervisores e diretores
 *
 * Envia emails de relatório para:
 * - Supervisores: lista dos membros não-compliant da sua equipe
 * - Diretores: relatório consolidado de todos os colaboradores
 */
function createFridayReportTask(app: FastifyInstance) {
  return new AsyncTask(
    'weekly-compliance-friday-report',
    async () => {
      try {
        console.log('🏁 Job de relatório de compliance (sexta-feira) iniciado')

        const { startDate, endDate } = getNextWeekRange()

        // Formata as datas para exibição
        const nextWeekStart = format(startDate, 'dd/MM/yyyy', { locale: ptBR })
        const nextWeekEnd = format(endDate, 'dd/MM/yyyy', { locale: ptBR })

        // Busca todos os colaboradores com status de compliance
        const allMembers =
          await spaceReservationRepository.listNonCompliantUsers(
            startDate,
            endDate,
          )

        const compliantCount = allMembers.filter((m) => m.isCompliant).length
        const nonCompliantCount = allMembers.filter(
          (m) => !m.isCompliant,
        ).length

        console.log(
          `📊 Status geral: ${compliantCount} compliant, ${nonCompliantCount} não-compliant`,
        )

        // Se todo mundo cumpriu, não precisa enviar relatório
        if (nonCompliantCount === 0) {
          console.log(
            '✅ Todos os colaboradores cumpriram o compliance. Nenhum relatório enviado.',
          )
          return
        }

        // 📧 1. ENVIAR PARA SUPERVISORES
        const supervisors =
          await teamPositionsRepository.listByPosition('supervisor')

        console.log(
          `📧 Enviando relatório para ${supervisors.length} supervisores...`,
        )

        let emailIndex = 0

        for (const supervisor of supervisors) {
          try {
            // Controle de taxa de envio
            if (emailIndex > 0) {
              await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
            }
            emailIndex++

            // Busca membros da equipe deste supervisor
            const teamMembers =
              await spaceReservationRepository.listNonCompliantUsers(
                startDate,
                endDate,
                supervisor.id, // positionId do supervisor
              )

            const teamCompliantCount = teamMembers.filter(
              (m) => m.isCompliant,
            ).length
            const teamNonCompliantCount = teamMembers.filter(
              (m) => !m.isCompliant,
            ).length

            // Se a equipe está toda em dia, não envia email
            if (teamNonCompliantCount === 0) {
              console.log(
                `   ⏭️ ${supervisor.userName}: equipe 100% compliant, email pulado`,
              )
              continue
            }

            // Monta lista de membros não-compliant
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

            console.log(
              `   ✅ Supervisor ${supervisor.userName}: ${teamNonCompliantCount} pendentes`,
            )
          } catch (error) {
            console.log(
              `   ❌ Erro ao enviar para supervisor ${supervisor.userEmail}:`,
              error,
            )
          }
        }

        // 📧 2. ENVIAR PARA DIRETORES
        const directors =
          await teamPositionsRepository.listByPosition('director')

        console.log(
          `📧 Enviando relatório para ${directors.length} diretores...`,
        )

        for (const director of directors) {
          try {
            // Controle de taxa de envio
            if (emailIndex > 0) {
              await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
            }
            emailIndex++

            // Agrupa membros por supervisor para o relatório consolidado
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
                  missingDays: Math.max(
                    0,
                    member.requiredDays - member.reservedDays,
                  ),
                })
              }
            }

            // Filtra apenas supervisores com membros não-compliant
            const supervisorsSummary = Array.from(
              supervisorsSummaryMap.values(),
            )
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

            console.log(
              `   ✅ Diretor ${director.userName}: relatório consolidado enviado`,
            )
          } catch (error) {
            console.log(
              `   ❌ Erro ao enviar para diretor ${director.userEmail}:`,
              error,
            )
          }
        }

        console.log('📊 Job de relatório de compliance finalizado')
      } catch (error) {
        app.log.error(
          { err: error },
          '❌ Erro no job de relatório de compliance',
        )
      }
    },
    (err) => {
      app.log.error(
        { err },
        '❌ Erro na execução do job de relatório de compliance',
      )
    },
  )
}

/**
 * Cria o job de lembrete de quarta-feira
 * Executa às 02:00 da manhã (horário de São Paulo)
 *
 * Cron: 0 0 2 * * 3
 * - segundos: 0
 * - minutos: 0
 * - hora: 2
 * - dia do mês: * (qualquer)
 * - mês: * (qualquer)
 * - dia da semana: 3 (quarta-feira)
 */
export function createWednesdayComplianceReminderJob(app: FastifyInstance) {
  return new CronJob(
    {
      cronExpression: '0 0 2 * * 3', // Quarta às 02:00
      timezone: 'America/Sao_Paulo',
    },
    createWednesdayReminderTask(app),
    {
      preventOverrun: true,
    },
  )
}

/**
 * Cria o job de relatório de sexta-feira
 * Executa às 02:00 da manhã (horário de São Paulo)
 *
 * Cron: 0 0 2 * * 5
 * - segundos: 0
 * - minutos: 0
 * - hora: 2
 * - dia do mês: * (qualquer)
 * - mês: * (qualquer)
 * - dia da semana: 5 (sexta-feira)
 */
export function createFridayComplianceReportJob(app: FastifyInstance) {
  return new CronJob(
    {
      cronExpression: '0 0 2 * * 5', // Sexta às 02:00
      timezone: 'America/Sao_Paulo',
    },
    createFridayReportTask(app),
    {
      preventOverrun: true,
    },
  )
}
