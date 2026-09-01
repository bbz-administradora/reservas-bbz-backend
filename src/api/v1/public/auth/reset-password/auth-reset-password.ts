// src/api/v1/public/auth/reset-password/auth-reset-password.ts
import {
  authResetPasswordUseCase,
  authResetPasswordUseCaseSchema,
} from '@/models/auth/auth-reset-password-use-case'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { PgVerificationTokenRepository } from '@/repositories/pg/pg-verification-tokens-repository'
import {
  resetPasswordBodySchema,
  resetPasswordParamsSchema,
  resetPasswordResponseSchema,
} from '@/schemas/auth/reset-password-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const verificationTokensRepository = new PgVerificationTokenRepository()

  return { usersRepository, verificationTokensRepository }
}

export async function authResetPasswordController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/public/auth/reset-password/:userId/:token',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authResetPassword',
        summary: 'Redefine a senha do usuário com um token válido',
        description: `Redefine a senha do usuário utilizando um token de verificação enviado previamente por e-mail.

* **Segurança**: Acesso público, sem autenticação JWT.
* **Processo**:
  1. Verifica se o token de redefinição de senha é válido e não expirou
  2. Verifica se o usuário existe e está ativo
  3. Atualiza a senha do usuário
  4. Invalida o token utilizado para evitar reuso
  5. Retorna confirmação de sucesso com status 200 (OK), pois estamos atualizando recursos existentes

**Uso comum**: Página de redefinição de senha após o usuário clicar no link recebido por e-mail.`,
        params: resetPasswordParamsSchema,
        body: resetPasswordBodySchema,
        response: {
          200: resetPasswordResponseSchema,
          ...authResetPasswordUseCaseSchema,
        },
      },
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...request.params,
          ...request.body,
        },
      }

      const result = await authResetPasswordUseCase(inputData, deps)

      // Retorna 200 OK porque estamos atualizando recursos existentes, não criando novos
      return reply.status(200).send(result)
    },
  )
}
