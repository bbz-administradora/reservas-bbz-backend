import { env } from '@/infra/env'
import { InternalServerError } from '@/infra/errors'
import { s3 } from '@/lib/aws/s3'
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { IStorageAdapter } from '../base/storage-repository'

function extractBucketName(bucketUrl: string): string {
  const match = bucketUrl.match(/^https?:\/\/([^.]+)\./)
  if (!match) {
    throw new Error('Formato de bucket inválido')
  }
  return match[1]
}

// S3StorageAdapter implements the IStorageAdapter interface
export class S3StorageAdapter implements IStorageAdapter {
  async uploadFile(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const bucket = extractBucketName(env.PUBLIC_BUCKET)

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: buffer,
        ContentType: contentType,
      })
      await s3.send(command)
    } catch (error) {
      console.error('💥 Erro ao fazer upload do arquivo:', error)
      throw new InternalServerError({
        message: 'Erro ao fazer upload do arquivo no S3.',
        action: 'Verifique as credenciais ou tente novamente mais tarde.',
      })
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const bucket = extractBucketName(env.PUBLIC_BUCKET)

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
      })
      await s3.send(command)
    } catch (error) {
      console.error('💥 Erro ao deletar o arquivo:', error)
      throw new InternalServerError({
        message: 'Erro ao deletar o arquivo no S3.',
        action: 'Verifique as credenciais ou tente novamente mais tarde.',
      })
    }
  }

  async deleteFiles(prefix: string): Promise<void> {
    try {
      const bucket = extractBucketName(env.PUBLIC_BUCKET)
      let isTruncated = true
      let continuationToken: string | undefined

      while (isTruncated) {
        // Lista os objetos que iniciam com o prefixo informado
        const listResponse = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        )

        if (listResponse.Contents && listResponse.Contents.length > 0) {
          // Exclui os objetos em lote
          const deleteResponse = await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects: listResponse.Contents.map((obj) => ({
                  Key: obj.Key as string,
                })),
                Quiet: false,
              },
            }),
          )
        }

        isTruncated = listResponse.IsTruncated ?? false
        continuationToken = listResponse.NextContinuationToken
      }
    } catch (error) {
      console.error('💥 Erro ao deletar os arquivos:', error)
      throw new InternalServerError({
        message: 'Erro ao deletar os arquivos no S3.',
        action: 'Verifique as credenciais ou tente novamente mais tarde.',
      })
    }
  }

  /**
   * Retorna a URL pública de um arquivo no S3
   *
   * @param path Caminho do arquivo no S3
   * @returns URL pública para acesso direto ao arquivo
   */
  getPublicUrl(path: string): string {
    if (!path) {
      throw new Error('Caminho do arquivo não informado')
    }

    // Remova qualquer barra inicial se existir
    const normalizedPath = path.startsWith('/') ? path.substring(1) : path

    // Construa a URL usando o bucket público
    return `${env.PUBLIC_BUCKET}${normalizedPath}`
  }
}
