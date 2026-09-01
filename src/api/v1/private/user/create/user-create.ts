// src/api/v1/private/user/create/user-create.ts
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
  userCreateUseCase,
  userCreateUseCaseSchema,
} from '@/models/user/user-create-use-case'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  userCreateBodySchema,
  userCreateResponseSchema,
} from '@/schemas/user/user-create-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const accountRepository = new PgAccountsRepository()

  return { usersRepository, accountRepository }
}

export async function userCreateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/user',
    {
      schema: {
        tags: ['User'],
        operationId: 'userCreate',
        summary: 'Criar um novo usuário',
        description: `Este endpoint permite criar um novo usuário no sistema com as seguintes características:

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Verifica se já existe um usuário com o email fornecido
  2. Cria o registro de usuário com nome, email, cpf e perfil definido
  3. Configura uma conta Google associada ao usuário
  4. Retorna o usuário criado com seu ID e perfil, incluindo status da conta

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis 'admin' e 'dev'
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        body: userCreateBodySchema,
        response: {
          201: userCreateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...userCreateUseCaseSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...(request.body || {}),
        },
      }

      const result = await userCreateUseCase(inputData, deps)

      return reply.status(201).send(result)
    },
  )
}
