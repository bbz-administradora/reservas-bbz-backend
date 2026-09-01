// src/api/v1/private/user/delete/user-delete.ts
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
  deleteUser,
  deleteUserSchema,
} from '@/models/user/user-delete-use-case'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  userDeleteParamsSchema,
  userDeleteResponseSchema,
} from '@/schemas/user/user-delete-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const accountRepository = new PgAccountsRepository()
  const sessionRepository = new PgSessionsRepository()

  return { usersRepository, accountRepository, sessionRepository }
}

export async function userDeleteController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/v1/private/user/:id',
    {
      schema: {
        tags: ['User'],
        operationId: 'deleteUser',
        summary: 'Excluir um usuário',
        description: `Este endpoint permite excluir permanentemente um usuário específico do sistema.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Restrições**:
  1. Um usuário não pode excluir sua própria conta
  2. Apenas usuários com perfil 'admin' ou 'dev' podem excluir usuários
* **Processo de exclusão**:
  1. Valida o ID do usuário a ser excluído
  2. Exclui as sessões ativas do usuário
  3. Remove contas vinculadas (Google, etc.)
  4. Remove o registro do usuário do banco de dados

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: userDeleteParamsSchema,
        response: {
          200: userDeleteResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...deleteUserSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await deleteUser({ request, params: request.params }, deps)

      return reply.status(200).send(result)
    },
  )
}
