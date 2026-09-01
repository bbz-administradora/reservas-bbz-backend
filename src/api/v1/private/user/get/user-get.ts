// src/api/v1/private/user/get/user-get.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import {
  validateUserRole,
  validateUserRoleSchema,
} from '@/middlewares/validate-user-role'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  userGetUseCase,
  userGetUseCaseSchema,
} from '@/models/user/user-get-use-case'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  userGetParamsSchema,
  userGetResponseSchema,
} from '@/schemas/user/user-get-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  return { usersRepository }
}

export async function userGetController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/user/:id',
    {
      schema: {
        tags: ['User'],
        operationId: 'userGet',
        summary: 'Obter detalhes de um usuário',
        description: `Este endpoint retorna os detalhes completos de um usuário específico identificado pelo ID.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Valida o ID do usuário solicitado
  2. Busca informações detalhadas do usuário no banco de dados
  3. Retorna dados completos do perfil do usuário

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: userGetParamsSchema,
        response: {
          200: userGetResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...userGetUseCaseSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...request.params,
        },
      }

      const result = await userGetUseCase(inputData, deps)

      return reply.status(200).send(result)
    },
  )
}
