import { requestContext } from '@fastify/request-context'
import { Client, Pool, PoolClient } from 'pg'
import { env } from './env'
import { DatabaseError } from './errors'

const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
})

// Tratar erros não capturados do pool para evitar crash da aplicação
pool.on('error', (err, client) => {
  console.error('💥 Erro inesperado no pool de conexões:', err.message)
  // O pool automaticamente remove a conexão problemática
})

/**
 * @deprecated REMOVIDO - set_config estava executando em TODA query causando overhead massivo.
 *
 * PROBLEMA IDENTIFICADO:
 * - Cada database.query() executava 2 queries extras de set_config ANTES da query real
 * - Isso gerou ~4.9 milhões de chamadas desnecessárias ao banco
 * - Não existem políticas RLS que utilizem app.user_id ou app.user_role
 * - O terceiro parâmetro 'false' era inconsistente com pool de conexões (persistia na sessão)
 *
 * SOLUÇÃO: Função mantida apenas para compatibilidade, mas não é mais chamada automaticamente.
 * Se no futuro precisar de RLS com contexto de usuário:
 * 1. Criar políticas RLS reais que usem current_setting('app.user_id')
 * 2. Usar set_config com is_local=true (apenas para a transação)
 * 3. Combinar as 2 queries em 1: SELECT set_config('app.user_id', $1, true), set_config('app.user_role', $2, true)
 */
async function setUserContext(client: PoolClient) {
  const userId = requestContext.get('userId')
  const userRole = requestContext.get('userRole')

  if (userId && userRole) {
    await client.query(`SELECT set_config('app.user_id', $1, false);`, [userId])
    await client.query(`SELECT set_config('app.user_role', $1, false);`, [
      userRole,
    ])
  }
}

/**
 * Executa uma query utilizando o pool de conexões.
 *
 * Envolve a operação em try/catch para capturar erros e encapsulá-los em um DatabaseError,
 * garantindo que o erro seja tratado de forma padronizada pelo globalErrorHandler.
 *
 * @param queryObject - Objeto contendo a query e seus parâmetros.
 * @returns Resultado da query.
 * @throws {DatabaseError} Em caso de erro durante a execução da query.
 */
async function queryWithPool(queryObject: any) {
  let client: PoolClient | undefined
  try {
    client = await getNewClient()
    // REMOVIDO: await setUserContext(client)
    // ↑ Eliminado overhead de 2 queries extras por operação (set_config não estava sendo usado por RLS)
    const result = await client.query(queryObject)
    return result
  } catch (error) {
    console.error('💥 Error executing query', error)
    // Lança um DatabaseError com os 3 argumentos esperados: message, action e details
    throw new DatabaseError({
      action:
        'Revise as credenciais e verifique a disponibilidade do servidor de banco de dados.',
    })
  } finally {
    if (client) {
      // Optional chaining para não mascarar possíveis erros na liberação da conexão
      client?.release()
    }
  }
}

/**
 * Executa várias queries no mesmo cliente, dentro de uma transação.
 *
 * `database.query` pega um cliente do pool por query, então duas chamadas
 * seguidas podem cair em conexões diferentes — não há como torná-las atômicas.
 * Onde dois efeitos precisam valer como um só fato, use esta função.
 *
 * O primeiro caso é o job de presença: marcar a reserva como avaliada e somar a
 * advertência ao usuário. Fora de transação, morrer entre as duas perde a
 * advertência para sempre, porque a reserva já não está mais `pending` e nenhuma
 * reexecução a encontra.
 *
 * @param fn - Recebe o cliente da transação. Toda query do bloco precisa usá-lo.
 * @returns O que o callback devolver.
 * @throws Propaga o erro do callback, depois do ROLLBACK.
 */
async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getNewClient()

  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      // Um ROLLBACK que falha não pode mascarar o erro original.
    })
    throw error
  } finally {
    client.release()
  }
}

/**
 * Executa uma query utilizando um cliente novo (fora do pool).
 *
 * Geralmente utilizada para migrações e rotinas administrativas.
 *
 * @param queryObject - Objeto contendo a query e seus parâmetros.
 * @returns Resultado da query.
 * @throws {DatabaseError} Em caso de erro durante a execução da query.
 */
async function queryWithoutPool(queryObject: any) {
  const client = await getNewClientWithOutPool()
  try {
    const result = await client.query(queryObject)
    return result
  } catch (error) {
    console.error('💥 Error executing query', error)
    throw new DatabaseError({
      action:
        'Revise as credenciais e verifique a disponibilidade do servidor de banco de dados.',
    })
  } finally {
    await client?.end()
  }
}

/**
 * Obtém um novo cliente a partir do pool.
 *
 * @returns Instância de PoolClient.
 */
async function getNewClient() {
  const client = await pool.connect()
  return client
}

/**
 * Cria uma nova instância de Client (não utiliza pool).
 *
 * @returns Instância de Client.
 */
async function getNewClientWithOutPool() {
  const client = new Client({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    database: env.POSTGRES_DB,
    password: env.POSTGRES_PASSWORD,
  })

  await client.connect()
  return client
}

const database = {
  setUserContext,
  query: queryWithPool,
  withTransaction,
  getNewClient,
  getNewClientWithOutPool,
  queryWithoutPool,
  pool,
}

export { database }
