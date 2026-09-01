// src/api/v1/private/outpost/outpost-delete.ts

import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  outpostDeleteUseCase,
  outpostDeleteUseCaseSchema,
} from '@/models/outpost/outpost-delete-use-case'
import { PgOutpostsRepository } from '@/repositories/pg/pg-outposts-repository'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  outpostDeleteParamsSchema,
  outpostDeleteResponseSchema,
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

export async function outpostDeleteController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/v1/private/outposts/:id',
    {
      schema: {
        tags: ['Outposts'],
        operationId: 'deleteOutpost',
        summary: 'Encerrar posto avançado',
        description: `
Encerra um posto avançado (seta end_date para data anterior).

**Importante:** Esta ação NÃO deleta o registro, apenas encerra o posto
mantendo o histórico.

**Permissões:**
- Admin/Dev: pode encerrar qualquer posto
- Diretor: pode encerrar qualquer posto
- Supervisor: pode encerrar apenas postos de membros da própria equipe

**Comportamento:**
- O posto é encerrado com end_date = ontem
- O histórico é mantido para consulta
- O usuário volta a seguir as regras normais de reserva
        `,
        security: [{ bearerAuth: [] }],
        params: outpostDeleteParamsSchema,
        response: {
          200: outpostDeleteResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...outpostDeleteUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await outpostDeleteUseCase(
        { request, params: request.params },
        deps,
      )
      return reply.status(200).send(result)
    },
  )
}
