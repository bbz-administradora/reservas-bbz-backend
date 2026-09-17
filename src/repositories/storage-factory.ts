import { env } from '@/infra/env'
import { IStorageAdapter } from './base/storage-repository'
import { S3StorageAdapter } from './s3/s3-storage-repository'
import { SupabaseStorageAdapter } from './supabase/supabase-storage-repository'

/**
 * Escolhe o adapter de storage pelo ambiente.
 *
 * É o único ponto do código que decide entre S3 e Supabase. Com isso, o
 * cutover e o rollback da migração são troca de STORAGE_DRIVER e restart,
 * sem deploy de código.
 */
export function createStorageRepository(): IStorageAdapter {
  if (env.STORAGE_DRIVER === 'supabase') {
    return new SupabaseStorageAdapter()
  }

  return new S3StorageAdapter()
}

/**
 * Descreve o storage ativo, para o log de boot.
 */
export function describeStorage(): string {
  return env.STORAGE_DRIVER === 'supabase'
    ? `supabase (bucket: ${env.SUPABASE_STORAGE_BUCKET})`
    : `s3 (bucket: ${env.PUBLIC_BUCKET})`
}
