// src/api/v1/private/image/delete/image-delete.ts
/**
 * Controller para exclusão de imagens.
 *
 * Este endpoint permite a exclusão segura de imagens armazenadas no storage.
 * Requer autenticação e validação do usuário, garantindo que apenas
 * usuários autorizados possam excluir recursos.
 *
 * O caminho completo da imagem (imagePath) é necessário e deve ser fornecido
 * no corpo da requisição.
 */

import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import { deleteImage, imageDeleteSchema } from '@/models/image/image-use-case'
import { createStorageRepository } from '@/repositories/storage-factory'
import {
  imageDeleteBodySchema,
  imageDeleteResponseSchema,
} from '@/schemas/image/image-delete-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const storageRepository = createStorageRepository()

  return {
    storageRepository,
  }
}

export async function imageDeleteController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/v1/private/image/s3/delete',
    {
      schema: {
        tags: ['Image'],
        operationId: 'deleteImage',
        summary: 'Excluir uma imagem',
        description: `Este endpoint permite que usuários autenticados excluam uma imagem do armazenamento. O caminho completo da imagem deve ser enviado no corpo da requisição.

        ## Como funciona:
        1. O sistema recebe o caminho da imagem a ser excluída via corpo da requisição
        2. Realiza validação de autenticação e permissões do usuário
        3. Localiza a imagem no bucket S3 pelo caminho fornecido
        4. Remove o arquivo do armazenamento
        5. Retorna uma confirmação de sucesso

        ## Estrutura do corpo da requisição:
        \`\`\`json
        {
          "imagePath": "images/grupo-subtitulo-timestamp.webp"
        }
        \`\`\`

        ## Exemplos de uso:
        DELETE /v1/private/image/s3/delete
        Body: { "imagePath": "images/espacos/sala-presidencia-20250512123045.webp" }

        DELETE /v1/private/image/s3/delete
        Body: { "imagePath": "images/produto-bebida-20250512123045.webp" }

        ## Observações:
        - O caminho da imagem (imagePath) deve ser o caminho completo retornado pelo endpoint de upload
        - Dependendo de como o arquivo foi criado, o caminho pode incluir ou não uma pasta intermediária
        - Este endpoint apenas exclui o arquivo físico do armazenamento
        - A atualização de referências no banco de dados deve ser feita por endpoints específicos
        - Requer autenticação via token JWT no header Authorization
        - Não é possível desfazer esta operação depois de confirmada`,
        security: [
          {
            bearerAuth: [],
          },
        ],
        body: imageDeleteBodySchema,
        response: {
          200: imageDeleteResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...imageDeleteSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const { imagePath } = request.body

      const result = await deleteImage({ request, imagePath }, deps)

      return reply.status(200).send(result)
    },
  )
}
