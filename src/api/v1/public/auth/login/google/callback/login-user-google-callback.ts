import { host } from '@/infra/hosts'
import { GoogleAuthProvider } from '@/lib/google/adapters/GoogleAuthProvider'
import { loginUserGoogleUseCase } from '@/models/user/login-user-google-use-case'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  loginUserGoogleCallbackQuerySchema,
  loginUserGoogleCallbackResponseSchema,
} from '@/schemas/auth/login-user-google-callback-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * Factory: Cria e retorna as dependências necessárias para o caso de uso.
 */
export function createDependencies() {
  const userRepository = new PgUsersRepository()
  const accountRepository = new PgAccountsRepository()
  const googleAuthProvider = new GoogleAuthProvider()

  return {
    userRepository,
    accountRepository,
    googleAuthProvider,
  }
}

/**
 * Controller para processar o callback de autenticação do Google.
 * Recebe o código de autorização, troca por tokens, busca informações do usuário,
 * cria ou atualiza o registro no banco de dados e configura a sessão.
 */
export async function loginGoogleCallbackController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/public/auth/login/google/callback',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'loginUserGoogleCallback',
        summary: 'Callback para autenticação com Google',
        description: `
          Este endpoint trata o callback de autenticação via Google OAuth2. Ele recebe, por query string, o código de autorização fornecido pelo Google, faz a troca por tokens de acesso e refresh, e em seguida busca os dados de perfil do usuário (nome, e-mail, foto e status de e-mail verificado).

          Se o usuário já existir no banco, seus dados serão atualizados com as informações mais recentes do Google; caso contrário, um erro será retornado informando que a conta não foi encontrada. Depois, o repositório de contas (accounts) também é atualizado, armazenando os tokens para chamadas futuras à API Calendar.

          Em seguida, a aplicação gera seus próprios tokens de sessão (JWT e refresh token), configura os cookies de autenticação no cliente e persiste a sessão no banco, removendo registros expirados. Por fim, redireciona o usuário de volta ao frontend com status 302, levando em conta falhas (código ausente, conta não encontrada ou erros internos) e incluindo, em caso de erro, parâmetros de nome, mensagem, ação e código HTTP para que o frontend exiba a notificação adequada ao usuário.
        `,
        querystring: loginUserGoogleCallbackQuerySchema,
        response: {
          302: loginUserGoogleCallbackResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { code, state } = request.query

      if (!code) {
        return reply
          .status(302)
          .redirect(
            `${host.webAdmin}/login?name=BadRequestError&message=Code não encontrado&action=Usuário deve autorizar o login com Google&statusCode=400`,
          )
      }

      const deps = createDependencies()

      const result = await loginUserGoogleUseCase(
        {
          code,
          state,
        },
        deps,
        reply,
      )

      let url = `${host.webAdmin}/login?name=Success&message=Login realizado com sucesso&action=Usuário autenticado com sucesso&statusCode=200`

      if (result.statusCode !== 200) {
        url = `${host.webAdmin}/login?name=${result.name}&message=${result.message}&action=${result.action}&statusCode=${result.statusCode}`
      }

      return reply.status(302).redirect(url)
    },
  )
}
