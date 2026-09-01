// src/api/v1/private/space/update/space-update.ts
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
  updateSpace,
  updateSpaceSchema,
} from '@/models/space/space-update-use-case'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceUpdateBodySchema,
  spaceUpdateParamsSchema,
  spaceUpdateResponseSchema,
} from '@/schemas/space/space-update-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  return { spacesRepository }
}

export async function spaceUpdateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/space/:id',
    {
      schema: {
        tags: ['Space'],
        operationId: 'updateSpace',
        summary: 'Atualizar dados parciais de um espaço',
        description: `Este endpoint permite atualizar parcialmente os dados de um espaço específico por meio de um PATCH.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Atualização parcial**: Implementa o conceito de PATCH, atualizando apenas os campos enviados na requisição.
* **Processo**:
  1. Valida o ID do espaço a ser atualizado
  2. Verifica se o espaço existe no banco de dados
  3. Aplica apenas as alterações enviadas no corpo da requisição
  4. Retorna o espaço com os dados atualizados

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: spaceUpdateParamsSchema,
        body: spaceUpdateBodySchema,
        response: {
          200: spaceUpdateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...updateSpaceSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await updateSpace(
        { params: request.params, data: request.body },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
