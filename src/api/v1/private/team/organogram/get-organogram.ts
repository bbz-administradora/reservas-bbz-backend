// src/api/v1/private/team/organogram/get-organogram.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getOrganogramUseCase,
  getOrganogramUseCaseSchema,
} from '@/models/team/organogram'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { getOrganogramResponseSchema } from '@/schemas/team/organogram'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return { teamPositionsRepository }
}

export async function getOrganogramController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/team/organogram',
    {
      schema: {
        tags: ['Team'],
        operationId: 'getOrganogram',
        summary: 'Buscar o organograma completo da equipe',
        description: `Este endpoint retorna a árvore hierárquica completa da equipe de atendimento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Qualquer usuário autenticado pode visualizar o organograma.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Estrutura da resposta**:
- \`tree\`: Árvore hierárquica começando pelos diretores
  - Cada nó possui \`subordinates\` com seus subordinados diretos
- \`stats\`: Estatísticas com total e quantidade por posição

**Hierarquia**:
1. Director (nível 1) → nomeia Supervisors
2. Supervisor (nível 2) → nomeia Managers
3. Manager (nível 3) → nomeia Assistant Managers e Assistants
4. Assistant Manager (nível 4) → nomeia Assistants
5. Assistant (nível 5) → base da equipe

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        response: {
          200: getOrganogramResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getOrganogramUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getOrganogramUseCase(deps)

      return reply.status(200).send(result)
    },
  )
}
