// src/api/v1/private/outpost/outpost-update.ts

import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  outpostUpdateUseCase,
  outpostUpdateUseCaseSchema,
} from '@/models/outpost/outpost-update-use-case'
import { PgOutpostsRepository } from '@/repositories/pg/pg-outposts-repository'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  outpostUpdateBodySchema,
  outpostUpdateParamsSchema,
  outpostUpdateResponseSchema,
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

export async function outpostUpdateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/v1/private/outposts/:id',
    {
      schema: {
        tags: ['Outposts'],
        operationId: 'updateOutpost',
        summary: 'Atualizar posto avançado',
        description: `
Atualiza um posto avançado existente.

**Permissões:**
- Admin/Dev: pode atualizar qualquer posto
- Diretor: pode atualizar qualquer posto
- Supervisor: pode atualizar apenas postos de membros da própria equipe

**Campos editáveis:**
- clientName: Nome do cliente/posto
- clientAddress: Endereço completo do cliente
- endDate: Data fim (YYYY-MM-DD) ou null
- weekdays: Array de dias da semana [0-6]

**Campos NÃO editáveis:**
- userId (membro)
- startDate (data de início)
        `,
        security: [{ bearerAuth: [] }],
        params: outpostUpdateParamsSchema,
        body: outpostUpdateBodySchema,
        response: {
          200: outpostUpdateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...outpostUpdateUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await outpostUpdateUseCase(
        { request, params: request.params, body: request.body },
        deps,
      )
      return reply.status(200).send(result)
    },
  )
}
