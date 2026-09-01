// src/api/v1/private/space/list/space-list.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { validateUserRoleSchema } from '@/middlewares/validate-user-role'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  listSpaces,
  listSpacesSchema,
} from '@/models/space/space-list-use-case'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceListQuerySchema,
  spaceListResponseSchema,
} from '@/schemas/space/space-list-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  return { spacesRepository }
}

export async function spaceListController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/space',
    {
      schema: {
        tags: ['Space'],
        operationId: 'listSpaces',
        summary: 'Listar espaços com filtros e paginação',
        description: `Este endpoint permite listar espaços com filtros e paginação.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Recursos de busca**:
  1. Filtragem por termo de busca (name e description)
  2. Filtragem por status de ativação (isActive)
  3. Filtragem por faixa de capacidade
  4. Paginação com controle de página atual e tamanho da página
* **Resposta**: Retorna lista de espaços paginada com metadados de paginação

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Permite acesso aos perfis 'admin', 'dev' e 'user'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        querystring: spaceListQuerySchema,
        response: {
          200: spaceListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...listSpacesSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await listSpaces({ query: request.query }, deps)

      return reply.status(200).send(result)
    },
  )
}
