// src/routes/reservationRoutes.ts
import { spaceReservationCancelController } from '@/api/v1/private/reservation/cancel/space-reservation-cancel'
import { cancelledReservationsListController } from '@/api/v1/private/reservation/cancelled-reservations-list'
import { cancelledReservationsOverviewController } from '@/api/v1/private/reservation/cancelled-reservations-overview'
import { spaceReservationCheckInOutController } from '@/api/v1/private/reservation/check-in-out/space-reservation-check-in-out'
import { spaceReservationCheckInOutListController } from '@/api/v1/private/reservation/check-in-out/space-reservation-check-in-out-list'
import { spaceReservationCloseController } from '@/api/v1/private/reservation/close/space-reservation-close'
import { spaceReservationCreateController } from '@/api/v1/private/reservation/create/space-reservation-create'
import { spaceReservationGetController } from '@/api/v1/private/reservation/get/space-reservation-get'
import { spaceReservationListController } from '@/api/v1/private/reservation/list/space-reservation-list'
import { spaceReservationStatsController } from '@/api/v1/private/reservation/stats/space-reservation-stats'
import { weeklyComplianceDetailsController } from '@/api/v1/private/reservation/weekly-compliance-details'
import { weeklyComplianceOverviewController } from '@/api/v1/private/reservation/weekly-compliance-overview'
import { FastifyInstance } from 'fastify'

/**
 * Registra todas as rotas relacionadas a reservas de espaços
 */
export async function reservationRoutes(app: FastifyInstance) {
  app.register(spaceReservationCreateController)
  app.register(spaceReservationCloseController)
  app.register(spaceReservationCancelController)
  app.register(spaceReservationListController)
  app.register(spaceReservationStatsController)
  app.register(spaceReservationCheckInOutController)
  app.register(spaceReservationCheckInOutListController)
  app.register(spaceReservationGetController)
  app.register(weeklyComplianceOverviewController)
  app.register(weeklyComplianceDetailsController)
  app.register(cancelledReservationsOverviewController)
  app.register(cancelledReservationsListController)
}
