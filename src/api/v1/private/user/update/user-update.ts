// src/api/v1/private/user/update/user-update.ts
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
  userUpdateUseCase,
  userUpdateUseCaseSchema,
} from '@/models/user/user-update-use-case'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  userUpdateBodySchema,
  userUpdateParamsSchema,
  userUpdateResponseSchema,
} from '@/schemas/user/user-update-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  return { usersRepository }
}

export async function userUpdateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/user/:id',
    {
      schema: {
        tags: ['User'],
        operationId: 'userUpdate',
        summary: 'Atualizar dados parciais de um usuário',
        description: `Este endpoint permite atualizar parcialmente os dados de um usuário específico por meio de um PATCH.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Atualização parcial**: Implementa o conceito de PATCH, atualizando apenas os campos enviados na requisição.
* **Processo**:
  1. Valida o ID do usuário a ser atualizado
  2. Verifica se o usuário existe no banco de dados
  3. Aplica apenas as alterações enviadas no corpo da requisição
  4. Retorna o usuário com os dados atualizados

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: userUpdateParamsSchema,
        body: userUpdateBodySchema,
        response: {
          200: userUpdateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...userUpdateUseCaseSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        // Dados da requisição agrupados em 'data'
        data: {
          ...(request.params || {}),
          ...(request.body || {}),
        },
      }

      const result = await userUpdateUseCase(inputData, deps)

      return reply.status(200).send(result)
    },
  )
}
