import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import {
  verifyJWTRefresh,
  verifyJWTRefreshSchema,
} from '@/middlewares/verify-jwt'
import {
  refreshUserSession,
  refreshUserSessionSchema,
} from '@/models/user/refresh-user-session-use-case'
import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'
import { refreshUserSessionResponseSchema } from '@/schemas/auth/refresh-user-session-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  return {
    sessionRepository: new PgSessionsRepository(),
  }
}

export async function refreshUserSessionController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/auth/refresh-session',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'refreshUserSession',
        summary: 'Renova a sessão do usuário autenticado',
        description: `\
Renova a sessão do usuário autenticado, gerando novos tokens de acesso e refresh.

* **Segurança**: Protegido por JWT de refresh e CSRF.
* **Autorização**: Usuário autenticado.
* **Validação**: Conta ativa e sem necessidade de reset de senha.

Sobre o sessionId:
- O sessionId é extraído automaticamente do payload do JWT refresh token.
- O backend valida se o sessionId no token corresponde a uma sessão ativa no banco de dados.
- Não é necessário enviar o sessionId via header, pois ele já está contido no token JWT.
- O sessionId é mantido no banco enquanto a sessão estiver ativa.
`,
        security: [{ bearerAuth: [] }],
        response: {
          200: refreshUserSessionResponseSchema,
          ...verifyJWTRefreshSchema,
          ...validateUserAccountSchema,
          ...refreshUserSessionSchema,
        },
      },
      onRequest: [verifyJWTRefresh],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      // Não há body, params ou query, apenas contexto do usuário autenticado
      const input = {
        data: {},
      }

      const result = await refreshUserSession(input, deps, request, reply)

      return reply.status(200).send(result)
    },
  )
}
