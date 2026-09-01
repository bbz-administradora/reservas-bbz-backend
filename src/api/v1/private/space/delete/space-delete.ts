// src/api/v1/private/space/delete/space-delete.ts
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
  deleteSpace,
  deleteSpaceSchema,
} from '@/models/space/space-delete-use-case'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceDeleteParamsSchema,
  spaceDeleteResponseSchema,
} from '@/schemas/space/space-delete-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  return { spacesRepository }
}

export async function spaceDeleteController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/v1/private/space/:id',
    {
      schema: {
        tags: ['Space'],
        operationId: 'deleteSpace',
        summary: 'Excluir um espaço',
        description: `Este endpoint permite excluir um espaço específico permanentemente.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Valida o ID do espaço a ser excluído
  2. Verifica se o espaço existe no banco de dados
  3. Exclui permanentemente o espaço (hard delete)
  4. Retorna mensagem de confirmação

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: spaceDeleteParamsSchema,
        response: {
          200: spaceDeleteResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...deleteSpaceSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await deleteSpace(
        { request, params: request.params },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
