// src/infra/jobs/registry.ts

import {
  runAttendanceStatusUpdater,
  runEmailNotificationCollector,
} from './attendance/attendance-status'
import { runCleanupExpiredPreReservations } from './cleanup/expired-pre-reservations'
import { runCleanupExpiredReservations } from './cleanup/expired-reservations'
import {
  runFridayComplianceReport,
  runWednesdayComplianceReminder,
} from './compliance/weekly-compliance-notifier'
import { runMondayEarlyCheckoutReminder } from './early-checkout/weekly-reminder'
import { JobHandler } from './types'

interface JobEntry {
  handler: JobHandler

  /**
   * O job sabe parar no meio e continuar depois, porque seleciona o trabalho
   * pelo estado do dado e não por posição. Só esses devolvem `partial`.
   */
  resumable: boolean

  description: string
}

/**
 * Os sete jobs de negócio, por nome.
 *
 * **A chave é contrato.** A mesma string aparece em `jobs.job_definition.name`,
 * em `cron.job.jobname` e no `:name` da rota interna. Divergir quebra o disparo
 * sem erro de compilação, por isso `scripts/jobs/check-registry.mjs` compara
 * estas chaves com a lista esperada no CI.
 *
 * Quem agenda é o pg_cron, no banco. Aqui não existe horário: a agenda vive em
 * `supabase/migrations/*_jobs_runtime.sql` e é aplicada por
 * `jobs.sync_schedules()`. Ver docs/specs/02-jobs-pg-cron-supabase/.
 */
export const jobRegistry = {
  'cleanup-expired-pre-reservations': {
    handler: runCleanupExpiredPreReservations,
    resumable: false,
    description: 'Remove slots com pré-reserva expirada.',
  },
  'cleanup-expired-reservations': {
    handler: runCleanupExpiredReservations,
    resumable: false,
    description: 'Remove slots reservados de datas passadas.',
  },
  'attendance-status-updater': {
    handler: runAttendanceStatusUpdater,
    resumable: false,
    description:
      'Consolida presença do dia anterior, advertências e bloqueios de conta.',
  },
  'email-notification-data-collector': {
    handler: runEmailNotificationCollector,
    resumable: true,
    description:
      'Envia até 60 notificações de ausência ou checkout pendente por execução, a 1 e-mail/s.',
  },
  'weekly-compliance-wednesday-reminder': {
    handler: runWednesdayComplianceReminder,
    resumable: false,
    description:
      'Lembra por BCC os colaboradores ainda não compliant para a próxima semana.',
  },
  'weekly-compliance-friday-report': {
    handler: runFridayComplianceReport,
    resumable: false,
    description:
      'Envia pendências a supervisores e relatório consolidado a diretores.',
  },
  'weekly-early-checkout-monday-reminder': {
    handler: runMondayEarlyCheckoutReminder,
    resumable: false,
    description:
      'Envia a supervisores as ocorrências pendentes de checkout antecipado.',
  },
} satisfies Record<string, JobEntry>

export type JobName = keyof typeof jobRegistry

export const jobNames = Object.keys(jobRegistry) as JobName[]

export function isJobName(value: string): value is JobName {
  return Object.prototype.hasOwnProperty.call(jobRegistry, value)
}
