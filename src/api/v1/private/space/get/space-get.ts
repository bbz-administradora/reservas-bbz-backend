// src/api/v1/private/space/get/space-get.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { validateUserRoleSchema } from '@/middlewares/validate-user-role'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import { getSpace, getSpaceSchema } from '@/models/space/space-get-use-case'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceGetParamsSchema,
  spaceGetResponseSchema,
} from '@/schemas/space/space-get-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  return { spacesRepository }
}

export async function spaceGetController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/space/:id',
    {
      schema: {
        tags: ['Space'],
        operationId: 'getSpace',
        summary: 'Obter detalhes de um espaço',
        description: `Este endpoint permite obter os detalhes completos de um espaço específico.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Valida o ID do espaço a ser consultado
  2. Verifica se o espaço existe no banco de dados
  3. Retorna os detalhes completos do espaço

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Permite acesso aos perfis 'admin', 'dev' e 'user'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: spaceGetParamsSchema,
        response: {
          200: spaceGetResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...getSpaceSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getSpace({ params: request.params }, deps)

      return reply.status(200).send(result)
    },
  )
}
