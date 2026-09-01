// src/api/v1/private/team/positions/list-positions.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  listPositionsUseCase,
  listPositionsUseCaseSchema,
} from '@/models/team/positions'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  listPositionsParamsSchema,
  listPositionsResponseSchema,
} from '@/schemas/team/positions'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return { usersRepository, teamPositionsRepository }
}

export async function listPositionsController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/team/positions/:position',
    {
      schema: {
        tags: ['Team'],
        operationId: 'listPositions',
        summary: 'Listar todos os membros de uma posição na equipe',
        description: `Este endpoint retorna a lista de todos os membros de uma posição específica na equipe de atendimento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Baseada na hierarquia da equipe:
  - Admin/Dev → pode listar todas as posições
  - Director → pode listar todas as posições
  - Supervisor → pode listar Manager, Assistant Manager e Assistant
  - Manager → pode listar Assistant Manager e Assistant
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Posições disponíveis**:
- \`director\`: Diretores
- \`supervisor\`: Supervisores
- \`manager\`: Gerentes
- \`assistant_manager\`: Subgerentes
- \`assistant\`: Assistentes

**Retorno**:
- Lista de membros com dados do usuário (nome, email, avatar)
- Informações de quem nomeou cada membro
- Data de nomeação
- Nível hierárquico

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: listPositionsParamsSchema,
        response: {
          200: listPositionsResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...listPositionsUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await listPositionsUseCase(
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
