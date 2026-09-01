// src/api/v1/private/user/list/user-list.ts
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
  userListUseCase,
  userListUseCaseSchema,
} from '@/models/user/user-list-use-case'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  userListQuerySchema,
  userListResponseSchema,
} from '@/schemas/user/user-list-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  return { usersRepository }
}

export async function userListController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/user',
    {
      schema: {
        tags: ['User'],
        operationId: 'userList',
        summary: 'Listar todos os usuários',
        description: `Este endpoint permite listar os usuários do sistema com recursos avançados de consulta.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Recursos de consulta**:
  1. **Paginação**: Controle o número de resultados por página e a página atual
  2. **Ordenação**: Ordene por diferentes campos (nome, email, data de criação)
  3. **Filtragem**: Filtre usuários por papel, status da conta ou termos de busca
  4. **Busca**: Pesquise por nome, email ou outros campos relevantes

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        querystring: userListQuerySchema,
        response: {
          200: userListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...userListUseCaseSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...request.query,
        },
      }

      const result = await userListUseCase(inputData, deps)

      return reply.status(200).send(result)
    },
  )
}
