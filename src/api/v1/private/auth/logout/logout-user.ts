import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import {
  verifyJWTRefresh,
  verifyJWTRefreshSchema,
} from '@/middlewares/verify-jwt'
import { logoutUser } from '@/models/user/logout-user-use-case'
import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'
import { logoutUserResponseSchema } from '@/schemas/auth/logout-user-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const sessionRepository = new PgSessionsRepository()

  return {
    sessionRepository,
  }
}

export async function logoutUserController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/auth/logout/user',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'logoutUser',
        summary: 'Desconectar usuário',
        description:
          'Este endpoint realiza o logout do usuário ao encerrar sua sessão atual. Quando acionado, o sistema identifica a sessão do usuário atual através do token de atualização (refresh token), remove esta sessão específica do banco de dados e limpa todos os cookies de autenticação no navegador do usuário.\n\nProcesso de execução:\n\n - Validação de Segurança: Confirma a identidade do usuário através do token JWT de atualização e verifica se o token CSRF está presente e é válido.\n\n - Encerramento de Sessão: Remove apenas a sessão atual do banco de dados, mantendo outras sessões ativas do mesmo usuário em outros dispositivos.\n\n - Limpeza de Cookies: Remove os cookies de autenticação (token de sessão, token de atualização e token CSRF) do navegador do usuário, definindo-os como expirados.\n\nApós o logout bem-sucedido, o usuário precisará se autenticar novamente para acessar recursos protegidos da aplicação. O endpoint retorna uma mensagem de confirmação quando o logout é concluído com sucesso.',
        security: [
          {
            bearerAuth: [],
          },
        ],
        response: {
          200: logoutUserResponseSchema,
          ...verifyJWTRefreshSchema,
          ...validateUserAccountSchema,
        },
      },
      onRequest: [verifyJWTRefresh],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await logoutUser({ request, reply }, deps)

      return reply.status(200).send(result)
    },
  )
}
