// src/api/v1/public/auth/login-credential/auth-login-credential.ts
import {
  authLoginCredentialUseCase,
  authLoginCredentialUseCaseSchema,
} from '@/models/auth/auth-login-credential-use-case'
// Importar repositories necessários
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
// Importar schemas
import {
  loginUserCredentialBodySchema,
  loginUserCredentialResponseSchema,
} from '@/schemas/auth/login-user-credential-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  // Instanciar repositories necessários
  const usersRepository = new PgUsersRepository()

  return { usersRepository }
}

export async function authLoginCredentialController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/public/auth/login/credential',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authLoginCredential',
        summary: 'Autenticação com credenciais (email e senha)',
        description: `Endpoint para autenticação de usuários com email e senha.

* **Segurança**: Endpoint público, não requer autenticação prévia.
* **Processo**:
  1. Valida os dados de entrada (email e senha)
  2. Verifica se o usuário existe e se a senha está correta
  3. Cria uma sessão para o usuário e retorna os dados do usuário autenticado

**Dados de entrada**:
- Email do usuário (obrigatório)
- Senha do usuário (obrigatório)

**Resposta**:
- Dados do usuário autenticado
- Mensagem de confirmação`,
        body: loginUserCredentialBodySchema,
        response: {
          200: loginUserCredentialResponseSchema,
          ...authLoginCredentialUseCaseSchema,
        },
      },
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...(request.body || {}),
        },
      }

      const result = await authLoginCredentialUseCase(inputData, deps, reply)

      return reply.status(200).send(result)
    },
  )
}
