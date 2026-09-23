import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { app } from './app'
import { database } from './infra/database'
import { env } from './infra/env'
import { InternalServerError } from './infra/errors'
import { host } from './infra/hosts'
import { describeStorage } from './repositories/storage-factory'

// Função para fechar o pool quando a aplicação é encerrada
function gracefulShutdown() {
  console.log('\n🔄 Encerrando pool de conexões...')
  database.pool
    .end()
    .then(() => {
      console.log('\n✅ Pool de conexões encerrado.')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Erro ao encerrar o pool de conexões:', error)
      process.exit(1)
    })
}

async function fetchAndSaveSwaggerJson() {
  try {
    const url = `${host.api}/docs/json`

    const username = env.API_DOC_USER
    const password = env.API_DOC_PASSWORD

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
      },
    })

    if (!response.ok) {
      throw new InternalServerError({
        message: `Falha ao buscar Swagger JSON: ${response.statusText}`,
        action: 'Verifique o endpoint e as credenciais fornecidas.',
      })
    }

    const swaggerSpec = await response.json()
    const outputPath = resolve(__dirname, 'swagger.json')

    await writeFile(outputPath, JSON.stringify(swaggerSpec, null, 2), 'utf-8')
    console.log(`\n📄 Swagger JSON file saved at ${outputPath}`)
  } catch (error) {
    console.error('❌ Failed to fetch and save Swagger JSON:', error)
  }
}

// Inicialização do servidor
app
  .listen({
    port: env.API_PORT,
    host: '0.0.0.0', // to react native work, must be added this line
  })
  .then(() => {
    // Create the Swagger JSON file only in development
    if (env.NODE_ENV === 'development') {
      fetchAndSaveSwaggerJson()
    }

    console.log(`\n⚡ Server is running on port ${env.API_PORT} ⚡`)
    console.log(`📦 Storage: ${describeStorage()}\n`)
  })

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
