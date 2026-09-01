// src/routes/spaceSlotRoutes.ts
import { spaceSlotAvailabilityController } from '@/api/v1/private/space-slot/availability/space-slot-availability'
import { spaceSlotListController } from '@/api/v1/private/space-slot/list/space-slot-list'
import { spaceSlotPreReserveController } from '@/api/v1/private/space-slot/pre-reserve/create/space-slot-pre-reserve'
import { spaceSlotPreReserveDeleteController } from '@/api/v1/private/space-slot/pre-reserve/delete/space-slot-pre-reserve-delete'
import { FastifyInstance } from 'fastify'

/**
 * Registra todas as rotas relacionadas a slots de espaços
 */
export async function spaceSlotRoutes(app: FastifyInstance) {
  app.register(spaceSlotListController)
  app.register(spaceSlotAvailabilityController)
  app.register(spaceSlotPreReserveController)
  app.register(spaceSlotPreReserveDeleteController)
}
