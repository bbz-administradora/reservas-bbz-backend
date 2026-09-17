import { env } from '@/infra/env'
import { InternalServerError } from '@/infra/errors'
import { getSupabase } from '@/lib/supabase'
import { IStorageAdapter } from '../base/storage-repository'

// Quantidade de objetos por página ao percorrer uma pasta do bucket.
const TAMANHO_PAGINA = 100

// SupabaseStorageAdapter implements the IStorageAdapter interface
export class SupabaseStorageAdapter implements IStorageAdapter {
  private get bucket(): string {
    return env.SUPABASE_STORAGE_BUCKET
  }

  async uploadFile(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await getSupabase()
      .storage.from(this.bucket)
      .upload(path, buffer, { contentType, upsert: true })

    if (error) {
      console.error('💥 Erro ao fazer upload do arquivo:', {
        driver: 'supabase',
        bucket: this.bucket,
        path,
        error: error.message,
      })
      throw new InternalServerError({
        message: 'Erro ao fazer upload do arquivo no Supabase Storage.',
        action: 'Verifique as credenciais ou tente novamente mais tarde.',
      })
    }
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await getSupabase()
      .storage.from(this.bucket)
      .remove([path])

    if (error) {
      console.error('💥 Erro ao deletar o arquivo:', {
        driver: 'supabase',
        bucket: this.bucket,
        path,
        error: error.message,
      })
      throw new InternalServerError({
        message: 'Erro ao deletar o arquivo no Supabase Storage.',
        action: 'Verifique as credenciais ou tente novamente mais tarde.',
      })
    }
  }

  async deleteFiles(prefix: string): Promise<void> {
    try {
      const keys = await this.listRecursive(prefix)

      // Remove em lotes: a API aceita várias chaves por chamada.
      for (let i = 0; i < keys.length; i += TAMANHO_PAGINA) {
        const lote = keys.slice(i, i + TAMANHO_PAGINA)
        const { error } = await getSupabase()
          .storage.from(this.bucket)
          .remove(lote)

        if (error) {
          throw new Error(error.message)
        }
      }
    } catch (error) {
      console.error('💥 Erro ao deletar os arquivos:', {
        driver: 'supabase',
        bucket: this.bucket,
        prefix,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new InternalServerError({
        message: 'Erro ao deletar os arquivos no Supabase Storage.',
        action: 'Verifique as credenciais ou tente novamente mais tarde.',
      })
    }
  }

  /**
   * Retorna a URL pública de um arquivo no Supabase Storage
   *
   * @param path Caminho do arquivo no bucket
   * @returns URL pública para acesso direto ao arquivo
   */
  getPublicUrl(path: string): string {
    if (!path) {
      throw new Error('Caminho do arquivo não informado')
    }

    const normalizedPath = path.startsWith('/') ? path.substring(1) : path

    return getSupabase().storage.from(this.bucket).getPublicUrl(normalizedPath)
      .data.publicUrl
  }

  /**
   * Lista todas as chaves sob um prefixo, descendo nas subpastas.
   *
   * O `list` do Supabase enxerga uma pasta por vez e devolve o nome do item,
   * não a chave completa — diferente do ListObjectsV2 do S3, que é recursivo.
   * Subpasta vem com `id` nulo.
   */
  private async listRecursive(prefix: string): Promise<string[]> {
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '')
    const keys: string[] = []
    let offset = 0

    for (;;) {
      const { data, error } = await getSupabase()
        .storage.from(this.bucket)
        .list(normalizedPrefix, { limit: TAMANHO_PAGINA, offset })

      if (error) {
        throw new Error(error.message)
      }

      if (!data || data.length === 0) {
        break
      }

      for (const item of data) {
        const caminho = normalizedPrefix
          ? `${normalizedPrefix}/${item.name}`
          : item.name

        if (item.id === null) {
          keys.push(...(await this.listRecursive(caminho)))
        } else {
          keys.push(caminho)
        }
      }

      if (data.length < TAMANHO_PAGINA) {
        break
      }

      offset += TAMANHO_PAGINA
    }

    return keys
  }
}
