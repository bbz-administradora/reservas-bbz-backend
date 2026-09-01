// src/api/v1/private/space/qrcode/space-qrcode.ts

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
  spaceQrcodeUseCase,
  spaceQrcodeUseCaseSchema,
} from '@/models/space/space-qrcode-use-case'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { S3StorageAdapter } from '@/repositories/s3/s3-storage-repository'
import {
  spaceQrcodeParamsSchema,
  spaceQrcodeResponseSchema,
} from '@/schemas/space/space-qrcode-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceRepository = new PgSpacesRepository()
  const storageRepository = new S3StorageAdapter()

  return { spaceRepository, storageRepository }
}

export async function spaceQrcodeController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/space/:spaceId/qrcode',
    {
      schema: {
        tags: ['Space'],
        operationId: 'spaceQrcode',
        summary: 'Gerar QR Code para um espaço',
        description: `Gera um QR Code para um espaço específico, salva-o no S3 e atualiza a URL do QR Code no registro do espaço.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin', 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Valida o ID do espaço fornecido
  2. Verifica se o espaço já possui um QR Code
  3. Se já existir, retorna o QR Code existente
  4. Caso contrário, gera um QR Code com link para o espaço
  5. Salva o novo QR Code no S3
  6. Atualiza o registro do espaço com a URL do QR Code
  7. Retorna a URL do QR Code

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis especificados
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: spaceQrcodeParamsSchema,
        response: {
          200: spaceQrcodeResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...spaceQrcodeUseCaseSchema,
        },
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...(request.params || {}),
        },
      }

      const result = await spaceQrcodeUseCase(inputData, deps)

      return reply.status(200).send(result)
    },
  )
}
