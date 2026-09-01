// src/api/v1/private/space/create/space-create.ts
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
  createSpace,
  createSpaceSchema,
} from '@/models/space/space-create-use-case'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceCreateBodySchema,
  spaceCreateResponseSchema,
} from '@/schemas/space/space-create-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  return { spacesRepository }
}

export async function spaceCreateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/space',
    {
      schema: {
        tags: ['Space'],
        operationId: 'createSpace',
        summary: 'Criar um novo espaço',
        description: `Este endpoint permite criar um novo espaço no sistema com as seguintes características:

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo de criação**:
  1. Cria o registro de espaço com os dados fornecidos
  2. Retorna o espaço criado com seus dados completos
* **Resposta**: Retorna o espaço criado com seu ID e status

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        body: spaceCreateBodySchema,
        response: {
          201: spaceCreateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...createSpaceSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await createSpace({ request, data: request.body }, deps)

      return reply.status(201).send(result)
    },
  )
}
