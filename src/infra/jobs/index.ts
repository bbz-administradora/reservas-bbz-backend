import { FastifyInstance } from 'fastify'
import {
  createDailyAttendanceJob,
  createDailyEmailNotificationJob,
} from './attendance/attendance-status'
import { createExpiredPreReservationsCleanupJob } from './cleanup/expired-pre-reservations'
import { createExpiredReservationsCleanupJob } from './cleanup/expired-reservations'
import {
  createFridayComplianceReportJob,
  createWednesdayComplianceReminderJob,
} from './compliance/weekly-compliance-notifier'
import { createMondayEarlyCheckoutReminderJob } from './early-checkout/weekly-reminder'

/**
 * 🔄 Configuração e registro de todos os jobs agendados do sistema
 *
 * Jobs disponíveis:
 *
 * 📁 cleanup/
 *   - expiredPreReservationsCleanupJob: Limpeza de pré-reservas expiradas (a cada 30 min)
 *   - expiredReservationsCleanupJob: Limpeza de reservas expiradas (diário às 02:50)
 *
 * 📁 attendance/
 *   - dailyAttendanceJob: Atualização de status de presença (diário às 03:00)
 *   - dailyEmailNotificationJob: Envio de emails de notificação (diário às 03:10)
 *
 * 📁 compliance/
 *   - wednesdayComplianceReminderJob: Lembrete de compliance (quarta às 02:00)
 *   - fridayComplianceReportJob: Relatório de compliance (sexta às 02:00)
 *
 * 📁 early-checkout/
 *   - mondayEarlyCheckoutReminderJob: Lembrete de checkout antecipado (segunda às 02:00)
 */
export function setupJobs(app: FastifyInstance) {
  // 📁 Jobs de Cleanup
  const expiredPreReservationsCleanupJob =
    createExpiredPreReservationsCleanupJob(app)
  const expiredReservationsCleanupJob = createExpiredReservationsCleanupJob(app)

  // 📁 Jobs de Attendance
  const dailyAttendanceJob = createDailyAttendanceJob(app)
  const dailyEmailNotificationJob = createDailyEmailNotificationJob(app)

  // 📁 Jobs de Compliance
  const wednesdayComplianceReminderJob =
    createWednesdayComplianceReminderJob(app)
  const fridayComplianceReportJob = createFridayComplianceReportJob(app)

  // 📁 Jobs de Early Checkout
  const mondayEarlyCheckoutReminderJob =
    createMondayEarlyCheckoutReminderJob(app)

  // Registrar todos os jobs no scheduler
  app.scheduler.addSimpleIntervalJob(expiredPreReservationsCleanupJob)
  app.scheduler.addCronJob(expiredReservationsCleanupJob)
  app.scheduler.addCronJob(dailyAttendanceJob)
  app.scheduler.addCronJob(dailyEmailNotificationJob)
  app.scheduler.addCronJob(wednesdayComplianceReminderJob)
  app.scheduler.addCronJob(fridayComplianceReportJob)
  app.scheduler.addCronJob(mondayEarlyCheckoutReminderJob)

  // Log de configurações
  console.log(`\n✅ Jobs agendados com sucesso:`)
  console.log(`   📁 cleanup/`)
  console.log(`      • Limpeza de pré-reservas expiradas: a cada 30 minutos`)
  console.log(`      • Limpeza de reservas expiradas: às 02:50 diariamente`)
  console.log(`   📁 attendance/`)
  console.log(`      • Atualização de status de presença: às 03:00 diariamente`)
  console.log(`      • Envio de emails de notificação: às 03:10 diariamente`)
  console.log(`   📁 compliance/`)
  console.log(`      • Lembrete de compliance: quartas às 02:00`)
  console.log(`      • Relatório de compliance: sextas às 02:00`)
  console.log(`   📁 early-checkout/`)
  console.log(`      • Lembrete de checkout antecipado: segundas às 02:10\n`)
}
