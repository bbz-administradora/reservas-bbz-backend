// src/api/v1/private/team/positions/create-position.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  createPositionUseCase,
  createPositionUseCaseSchema,
} from '@/models/team/positions'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  createPositionBodySchema,
  createPositionParamsSchema,
  createPositionResponseSchema,
} from '@/schemas/team/positions'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return { usersRepository, teamPositionsRepository }
}

export async function createPositionController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/team/positions/:position',
    {
      schema: {
        tags: ['Team'],
        operationId: 'createPosition',
        summary: 'Nomear um membro para uma posição na equipe de atendimento',
        description: `Este endpoint permite nomear um usuário para uma posição na equipe de atendimento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Baseada na hierarquia da equipe:
  - Admin/Dev → pode nomear Director
  - Director → pode nomear Supervisor
  - Supervisor → pode nomear Manager
  - Manager → pode nomear Assistant Manager e Assistant
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Posições disponíveis**:
- \`director\`: Diretor (nível 1) - Apenas 1
- \`supervisor\`: Supervisor (nível 2) - Máximo 7
- \`manager\`: Gerente (nível 3) - Máximo 56
- \`assistant_manager\`: Subgerente (nível 4) - Máximo 20
- \`assistant\`: Assistente (nível 5) - Máximo 54

**Regras de negócio**:
1. Verificação de permissão baseada na hierarquia
2. O usuário deve existir no sistema (busca por email)
3. O usuário deve ter conta ativa
4. O usuário não pode ter perfil 'dev'
5. O usuário não pode já possuir uma posição na equipe

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: createPositionParamsSchema,
        body: createPositionBodySchema,
        response: {
          201: createPositionResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...createPositionUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await createPositionUseCase(
        {
          request,
          params: request.params,
          data: request.body,
        },
        deps,
      )

      return reply.status(201).send(result)
    },
  )
}
