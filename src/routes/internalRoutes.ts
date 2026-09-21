import { jobsRunController } from '@/api/v1/internal/jobs/jobs-run'
import { FastifyInstance } from 'fastify'

/**
 * Rotas de uso interno da infraestrutura. Não são públicas nem privadas no
 * sentido do resto da API: não têm JWT nem CSRF, e a autenticação é por segredo
 * compartilhado. Ficam fora do Swagger.
 */
export async function internalRoutes(app: FastifyInstance) {
  await app.register(jobsRunController)
}
