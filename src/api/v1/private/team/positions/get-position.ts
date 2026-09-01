// src/api/v1/private/team/positions/get-position.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getPositionUseCase,
  getPositionUseCaseSchema,
} from '@/models/team/positions'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  getPositionParamsSchema,
  getPositionResponseSchema,
} from '@/schemas/team/positions'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return { usersRepository, teamPositionsRepository }
}

export async function getPositionController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/team/positions/user/:userId',
    {
      schema: {
        tags: ['Team'],
        operationId: 'getPosition',
        summary: 'Buscar a posição de um usuário específico',
        description: `Este endpoint retorna a posição de um usuário específico na equipe de atendimento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Qualquer usuário autenticado pode consultar.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Retorno**:
- Dados da posição do usuário (ou null se não tiver posição)
- Tipo da posição
- Nível hierárquico
- Informações de quem nomeou
- Data de nomeação

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: getPositionParamsSchema,
        response: {
          200: getPositionResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getPositionUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getPositionUseCase(
        {
          params: request.params,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
