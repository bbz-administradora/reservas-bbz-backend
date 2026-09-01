// src/api/v1/private/occurrence/early-checkout-list.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  earlyCheckoutListUseCase,
  earlyCheckoutListUseCaseSchema,
} from '@/models/occurrence/early-checkout-list-use-case'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  earlyCheckoutListQuerySchema,
  earlyCheckoutListResponseSchema,
} from '@/schemas/occurrence/early-checkout-list-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const spaceCheckInOutRepository = new PgSpaceCheckInOutRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return { spaceCheckInOutRepository, teamPositionsRepository }
}

export async function earlyCheckoutListController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/occurrences/early-checkout',
    {
      schema: {
        tags: ['Occurrences'],
        operationId: 'listEarlyCheckoutOccurrences',
        summary: 'Listar ocorrências de checkout antecipado',
        description: `Este endpoint retorna a lista de ocorrências de checkout antecipado em workstations.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Baseada na role do sistema E na position do team:
  - Admin/Dev (roles do sistema) → podem ver todas as ocorrências
  - Director (position no team) → pode ver todas as ocorrências
  - Supervisor (position no team) → pode ver apenas ocorrências da sua equipe
  - Demais usuários → não têm acesso
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regras de negócio**:
- Sempre busca da pendência mais antiga até hoje (sem filtro de data)
- Retorna indicadores totalizadores (total, pendentes, justificadas, desconsideradas)
- Retorna período consultado (data mais antiga de pendência até hoje)
- Lista paginada de ocorrências com dados do colaborador e supervisor

**Filtros disponíveis**:
- \`status\`: 'pending', 'justified', 'dismissed', 'all'
- \`supervisorName\`: Busca parcial por nome do supervisor
- \`userName\`: Busca parcial por nome do colaborador
- \`userEmail\`: Busca parcial por email do colaborador
- \`position\`: 'manager', 'assistant_manager', 'assistant'

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        querystring: earlyCheckoutListQuerySchema,
        response: {
          200: earlyCheckoutListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...earlyCheckoutListUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await earlyCheckoutListUseCase(
        {
          request,
          query: request.query,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
