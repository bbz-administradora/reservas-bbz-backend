import { env } from '@/infra/env'
import { InternalServerError } from '@/infra/errors'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Cliente Supabase usado pelo storage.
 *
 * A instanciação é preguiçosa de propósito: enquanto STORAGE_DRIVER for 's3',
 * as variáveis do Supabase podem não existir no ambiente, e avaliar o cliente
 * na carga do módulo derrubaria o boot sem necessidade.
 *
 * Usa a service_role key, que ignora RLS. Ela nunca sai do servidor.
 */
export function getSupabase(): SupabaseClient {
  if (client) {
    return client
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new InternalServerError({
      message: 'Supabase não configurado.',
      action:
        'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de usar STORAGE_DRIVER=supabase.',
    })
  }

  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return client
}
