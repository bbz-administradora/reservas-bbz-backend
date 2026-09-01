import { serverHealthCheckController } from '@/api/v1/public/infra/server/health/server-health-check'
import { FastifyInstance } from 'fastify'

export async function infraRoutes(app: FastifyInstance) {
  app.register(serverHealthCheckController)
}
