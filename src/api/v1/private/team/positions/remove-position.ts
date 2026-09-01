// src/api/v1/private/team/positions/remove-position.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  removePositionUseCase,
  removePositionUseCaseSchema,
} from '@/models/team/positions'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  removePositionParamsSchema,
  removePositionResponseSchema,
} from '@/schemas/team/positions'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return { usersRepository, teamPositionsRepository }
}

export async function removePositionController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/v1/private/team/positions/:userId',
    {
      schema: {
        tags: ['Team'],
        operationId: 'removePosition',
        summary: 'Remover a posição de um membro da equipe',
        description: `Este endpoint permite remover a posição de um usuário na equipe de atendimento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Baseada na hierarquia da equipe:
  - Admin/Dev → pode remover qualquer posição
  - Quem nomeou → pode remover quem nomeou
  - Superiores → podem remover inferiores na hierarquia
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regras de negócio**:
1. Verificação de permissão baseada na hierarquia
2. O usuário deve possuir uma posição na equipe
3. Ao remover, o usuário volta a ser um usuário comum (sem posição)
4. Não é mantido histórico da remoção

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: removePositionParamsSchema,
        response: {
          200: removePositionResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...removePositionUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await removePositionUseCase(
        {
          request,
          params: request.params,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
