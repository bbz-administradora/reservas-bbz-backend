// src/api/v1/private/occurrence/early-checkout-justify.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  earlyCheckoutJustifyUseCase,
  earlyCheckoutJustifyUseCaseSchema,
} from '@/models/occurrence/early-checkout-justify-use-case'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  earlyCheckoutJustifyBodySchema,
  earlyCheckoutJustifyParamsSchema,
  earlyCheckoutJustifyResponseSchema,
} from '@/schemas/occurrence/early-checkout-justify-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const spaceCheckInOutRepository = new PgSpaceCheckInOutRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const usersRepository = new PgUsersRepository()

  return { spaceCheckInOutRepository, teamPositionsRepository, usersRepository }
}

/**
 * POST /v1/private/occurrences/early-checkout/:id/justify
 *
 * Justifica ou descarta uma ocorrência de checkout antecipado
 *
 * @description
 * Permite que supervisores, diretores ou administradores justifiquem
 * ou descartem ocorrências de checkout antecipado de colaboradores.
 *
 * Permissões:
 * - admin/dev: Pode justificar qualquer ocorrência
 * - director: Pode justificar qualquer ocorrência
 * - supervisor: Pode justificar apenas ocorrências de sua equipe
 * - outros cargos: Não podem justificar
 */
export async function earlyCheckoutJustifyController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/occurrences/early-checkout/:id/justify',
    {
      schema: {
        tags: ['Occurrences'],
        operationId: 'justifyEarlyCheckoutOccurrence',
        summary: 'Justificar ou descartar ocorrência de checkout antecipado',
        description: `Este endpoint permite justificar ou descartar uma ocorrência de checkout antecipado.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Baseada na role do sistema E na position do team:
  - Admin/Dev (roles do sistema) → podem justificar qualquer ocorrência
  - Director (position no team) → pode justificar qualquer ocorrência
  - Supervisor (position no team) → pode justificar apenas ocorrências da sua equipe
  - Demais usuários → não têm permissão
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regras de negócio**:
- A ocorrência deve existir e estar com status 'pending'
- Quando action = 'justified', o campo justification é obrigatório (mínimo 10 caracteres)
- Quando action = 'dismissed', a justificativa é opcional

**Ações disponíveis**:
- \`justified\`: Justifica a ocorrência com um texto explicativo
- \`dismissed\`: Descarta a ocorrência (erro de registro, por exemplo)
`,
        security: [{ bearerAuth: [] }],
        params: earlyCheckoutJustifyParamsSchema,
        body: earlyCheckoutJustifyBodySchema,
        response: {
          200: earlyCheckoutJustifyResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...earlyCheckoutJustifyUseCaseSchema,
        },
      },
      preHandler: [verifyJWT, validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await earlyCheckoutJustifyUseCase(
        {
          request,
          params: request.params,
          body: request.body,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
