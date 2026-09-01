// src/api/v1/private/outpost/outpost-list.ts

import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  outpostListUseCase,
  outpostListUseCaseSchema,
} from '@/models/outpost/outpost-list-use-case'
import { PgOutpostsRepository } from '@/repositories/pg/pg-outposts-repository'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  outpostListQuerySchema,
  outpostListResponseSchema,
} from '@/schemas/outpost/outpost-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  return {
    outpostsRepository: new PgOutpostsRepository(),
    teamPositionsRepository: new PgTeamPositionsRepository(),
    teamMemberSupervisorsRepository: new PgTeamMemberSupervisorsRepository(),
  }
}

export async function outpostListController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/outposts',
    {
      schema: {
        tags: ['Outposts'],
        operationId: 'listOutposts',
        summary: 'Listar postos avançados',
        description: `
Lista os postos avançados com paginação e filtros.

**Permissões:**
- Admin/Dev: vê todos os postos
- Diretor: vê todos os postos
- Supervisor: vê apenas postos da própria equipe

**Filtros:**
- status: 'active' | 'ended' | 'all' (default: 'active')
- search: busca por nome ou email do usuário
- page: página (default: 1)
- limit: itens por página (default: 20, max: 100)
        `,
        security: [{ bearerAuth: [] }],
        querystring: outpostListQuerySchema,
        response: {
          200: outpostListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...outpostListUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await outpostListUseCase(
        { request, query: request.query },
        deps,
      )
      return reply.status(200).send(result)
    },
  )
}
