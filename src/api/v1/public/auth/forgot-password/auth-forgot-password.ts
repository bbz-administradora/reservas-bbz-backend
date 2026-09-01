// src/api/v1/public/auth/forgot-password/auth-forgot-password.ts
import {
  authForgotPasswordUseCase,
  authForgotPasswordUseCaseSchema,
} from '@/models/auth/auth-forgot-password-use-case'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { PgVerificationTokenRepository } from '@/repositories/pg/pg-verification-tokens-repository'
import {
  forgotPasswordBodySchema,
  forgotPasswordResponseSchema,
} from '@/schemas/auth/forgot-password-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const verificationTokensRepository = new PgVerificationTokenRepository()

  return { usersRepository, verificationTokensRepository }
}

export async function authForgotPasswordController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/public/auth/forgot-password',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authForgotPassword',
        summary: 'Solicitar redefinição de senha',
        description: `Este endpoint permite ao usuário solicitar a redefinição de senha, enviando um email com instruções para criação de uma nova senha.

* **Segurança**: Endpoint público, não requer autenticação. Implementa verificações para impedir abuso.
* **Processo**:
  1. Valida o email fornecido
  2. Verifica se existe um usuário com o email informado
  3. Verifica se a conta do usuário está ativa
  4. Gera um token de redefinição de senha temporário
  5. Envia um email com instruções e link para redefinição
  6. Retorna confirmação de envio

**Processo detalhado**:
- O email contém um link que direciona o usuário para a página de redefinição de senha
- O token gerado é válido por 24 horas
- O sistema verifica a validade do token quando o usuário acessa o link de redefinição
- O email inclui tanto um botão de ação quanto o link em texto plano para maior acessibilidade`,
        body: forgotPasswordBodySchema,
        response: {
          201: forgotPasswordResponseSchema,
          ...authForgotPasswordUseCaseSchema,
        },
      },
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        // Dados da requisição agrupados em 'data'
        data: {
          ...(request.body || {}),
        },
      }

      const result = await authForgotPasswordUseCase(inputData, deps)

      return reply.status(201).send(result)
    },
  )
}
