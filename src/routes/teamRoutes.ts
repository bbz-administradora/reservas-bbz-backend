// src/routes/teamRoutes.ts
import { teamMembersController } from '@/api/v1/private/team/members/team-members'
import { getOrganogramController } from '@/api/v1/private/team/organogram'
import {
  createPositionController,
  getPositionController,
  listPositionsController,
  removePositionController,
  updateSupervisorController,
} from '@/api/v1/private/team/positions'
import { FastifyInstance } from 'fastify'

/**
 * Rotas de gerenciamento da equipe de atendimento
 *
 * Endpoints unificados para CRUD de posições:
 * - POST /v1/private/team/positions/:position - Criar posição
 * - GET /v1/private/team/positions/:position - Listar posições
 * - GET /v1/private/team/positions/user/:userId - Buscar posição de um usuário
 * - DELETE /v1/private/team/positions/:userId - Remover posição
 * - PATCH /v1/private/team/positions/:userId/supervisor - Atualizar supervisor
 * - GET /v1/private/team/organogram - Buscar organograma completo
 *
 * Hierarquia da equipe:
 * 1. Director (1) - Nomeado por Admin/Dev
 * 2. Supervisor (7) - Nomeado pelo Director
 * 3. Manager (56) - Nomeado pelo Supervisor
 * 4. Assistant Manager (20) - Nomeado pelo Manager
 * 5. Assistant (54) - Nomeado pelo Manager ou Assistant Manager
 */
export async function teamRoutes(app: FastifyInstance) {
  // Gerenciamento unificado de posições
  app.register(createPositionController)
  app.register(listPositionsController)
  app.register(getPositionController)
  app.register(removePositionController)
  app.register(updateSupervisorController)

  // Organograma da equipe
  app.register(getOrganogramController)

  // Listar membros da equipe para gestão
  app.register(teamMembersController)
}
