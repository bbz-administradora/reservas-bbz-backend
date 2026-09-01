// src/api/v1/private/outpost/outpost-create.ts

import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  outpostCreateUseCase,
  outpostCreateUseCaseSchema,
} from '@/models/outpost/outpost-create-use-case'
import { PgOutpostsRepository } from '@/repositories/pg/pg-outposts-repository'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  outpostCreateBodySchema,
  outpostCreateResponseSchema,
} from '@/schemas/outpost/outpost-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  return {
    outpostsRepository: new PgOutpostsRepository(),
    usersRepository: new PgUsersRepository(),
    teamPositionsRepository: new PgTeamPositionsRepository(),
    teamMemberSupervisorsRepository: new PgTeamMemberSupervisorsRepository(),
  }
}

export async function outpostCreateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/outposts',
    {
      schema: {
        tags: ['Outposts'],
        operationId: 'createOutpost',
        summary: 'Criar posto avançado',
        description: `
Cria um novo posto avançado para um membro da equipe.

**Permissões:**
- Admin/Dev: pode criar para qualquer usuário
- Diretor: pode criar para qualquer usuário
- Supervisor: pode criar apenas para membros da própria equipe

**Campos:**
- userId: ID do usuário que será colocado em posto avançado
- clientName: Nome do cliente/posto
- clientAddress: Endereço completo do cliente
- startDate: Data de início (YYYY-MM-DD)
- endDate: Data fim opcional (YYYY-MM-DD)
- weekdays: Array de dias da semana [0-6] (0=Dom, 6=Sáb)
        `,
        security: [{ bearerAuth: [] }],
        body: outpostCreateBodySchema,
        response: {
          201: outpostCreateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...outpostCreateUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await outpostCreateUseCase(
        { request, body: request.body },
        deps,
      )
      return reply.status(201).send(result)
    },
  )
}
