// src/api/v1/private/image/upload/image-upload.ts
/**
 * Controller para upload de imagens.
 *
 * Este endpoint permite o upload de imagens com organização flexível baseada em:
 * - group: categoria da imagem (obrigatório)
 * - subtitle: subtipo da imagem (opcional)
 * - establishmentId: identificador de estabelecimento (opcional)
 * - folder: diretório personalizado (opcional, default: userId)
 *
 * As imagens são armazenadas em uma estrutura organizada dentro do bucket,
 * na pasta 'images/' para melhor organização de ativos.
 */

import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import { imageUploadSchema, uploadImage } from '@/models/image/image-use-case'
import { createStorageRepository } from '@/repositories/storage-factory'
import {
  imageUploadQuerySchema,
  imageUploadResponseSchema,
} from '@/schemas/image/image-upload-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const storageRepository = createStorageRepository()

  return {
    storageRepository,
  }
}

export async function imageUploadController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/image/s3/upload',
    {
      schema: {
        tags: ['Image'],
        operationId: 'uploadImage',
        summary: 'Fazer upload de imagem',
        description: `Este endpoint permite que usuários autenticados façam upload de uma imagem para o armazenamento. A imagem deve ser enviada usando multipart/form-data com o campo "file".

        ## Parâmetros de consulta:
        - group (obrigatório): O grupo do ativo (ex: "avatar", "logo", "produto"). Indica o tipo ou categoria da imagem.
        - subtitle (opcional): Subtítulo para o ativo (ex: "perfil", "og", "bebida"). Quando fornecido, será concatenado com o grupo para formar o nome do arquivo.
        - folder (opcional): Pasta personalizada para armazenar a imagem. Se não fornecido, o arquivo será armazenado diretamente na pasta images.

        ## Como funciona:
        1. O sistema recebe a imagem via upload multipart/form-data
        2. Realiza validação de autenticação e permissões do usuário
        3. Processa os parâmetros de consulta (group, subtitle, folder)
        4. Gera um nome de arquivo único com timestamp
        5. Faz upload para o bucket S3 com a estrutura de pastas adequada
        6. Retorna o caminho completo da imagem salva

        ## Estrutura do caminho do arquivo:
        - Com folder: images/<folder>/<group>-<subtitle>-<timestamp>.webp
        - Sem folder: images/<group>-<subtitle>-<timestamp>.webp

        Onde:
        - folder: pasta personalizada (opcional)
        - group: categoria obrigatória da imagem
        - subtitle: subtipo opcional da imagem
        - timestamp: gerado no momento do upload em formato compacto (sem caracteres especiais)

        ## Exemplos de uso:
        POST /v1/private/image/s3/upload?folder=salas&group=sala&subtitle=presidencia
        POST /v1/private/image/s3/upload?group=produto

        ## Observações:
        - Todas as imagens são convertidas para o formato WebP para otimização
        - Este endpoint trata apenas o upload e retorna o caminho do arquivo
        - A atualização do banco de dados com o novo caminho da imagem (ex: mudar o avatar do usuário) deve ser tratada por outro endpoint
        - Requer autenticação via token JWT no header Authorization`,

        security: [
          {
            bearerAuth: [],
          },
        ],
        consumes: ['multipart/form-data'],
        querystring: imageUploadQuerySchema,
        response: {
          201: imageUploadResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...imageUploadSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const { group, subtitle, folder } = request.query

      const result = await uploadImage(
        { request, group, subtitle, folder },
        deps,
      )

      return reply.status(201).send(result)
    },
  )
}
