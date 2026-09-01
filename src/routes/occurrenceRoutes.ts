// src/routes/occurrenceRoutes.ts
import {
  earlyCheckoutJustifyController,
  earlyCheckoutListController,
} from '@/api/v1/private/occurrence'
import { FastifyInstance } from 'fastify'

/**
 * Rotas de gerenciamento de ocorrências
 *
 * Endpoints para gestão de ocorrências de checkout antecipado:
 * - GET /v1/private/occurrences/early-checkout - Listar ocorrências
 * - POST /v1/private/occurrences/early-checkout/:id/justify - Justificar/descartar ocorrência
 *
 * Regras de permissão:
 * - Admin/Dev/Director: Acesso a todas as ocorrências
 * - Supervisor: Acesso apenas às ocorrências da sua equipe
 */
export async function occurrenceRoutes(app: FastifyInstance) {
  // Listagem de ocorrências de checkout antecipado
  app.register(earlyCheckoutListController)

  // Justificar/descartar ocorrência
  app.register(earlyCheckoutJustifyController)
}
