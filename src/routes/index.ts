import { FastifyInstance } from 'fastify'
import { authRoutes } from './authRoutes'
import { catracaRoutes } from './catracaRoutes'
import { imageRoutes } from './imageRoutes'
import { infraRoutes } from './infraRoutes'
import { internalRoutes } from './internalRoutes'
import { occurrenceRoutes } from './occurrenceRoutes'
import { outpostRoutes } from './outpostRoutes'
import { reservationRoutes } from './reservationRoutes'
import { spaceRoutes } from './spaceRoutes'
import { spaceSlotRoutes } from './spaceSlotRoutes'
import { teamRoutes } from './teamRoutes'
import { userRoutes } from './userRoutes'

const routes = [
  infraRoutes,
  internalRoutes,
  authRoutes,
  userRoutes,
  imageRoutes,
  spaceRoutes,
  spaceSlotRoutes,
  reservationRoutes,
  teamRoutes,
  occurrenceRoutes,
  outpostRoutes,
  catracaRoutes,
]

/**
 * 🔹 Registra todas as rotas automaticamente no Fastify
 */
export async function registerRoutes(app: FastifyInstance) {
  for (const route of routes) {
    await app.register(route)
  }
}
