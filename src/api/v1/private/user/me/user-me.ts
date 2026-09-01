import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import { userMe, userMeUseCaseSchema } from '@/models/user/user-me-use-case'
import { userMeResponseSchema } from '@/schemas/user/user-me-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  // Não há dependências específicas para este caso de uso
  return {}
}

export async function userMeController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/user/me',
    {
      schema: {
        tags: ['User'],
        operationId: 'userMe',
        summary: 'Obter dados do usuário autenticado',
        description: `Este endpoint recupera os dados completos do usuário atualmente autenticado.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com conta ativa.
* **Validação de conta**: Verifica se a conta do usuário está ativa e não requer reset de senha.
* **Processo**:
  1. Valida a autenticação do usuário via token JWT
  2. Verifica se a conta do usuário está ativa
  3. Recupera os dados completos do usuário
  4. Verifica se o usuário autorizou integração com calendário Google

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário está ativa`,
        security: [{ bearerAuth: [] }],
        response: {
          200: userMeResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...userMeUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        userAccount: request.requestContext.get('userAccount'),
        data: {},
      }

      const result = await userMe(inputData, deps)

      return reply.status(200).send(result)
    },
  )
}
