// src/infra/jobs/cli.ts
//
// Execução local de um job, sob demanda:
//
//   npm run job:run -- cleanup-expired-pre-reservations
//
// Não existe disparo automático no ambiente local: o Postgres do compose não
// tem pg_cron nem pg_net, e um job disparando sozinho às 02:50 na máquina de
// quem desenvolve não serve para nada. O que se quer localmente é "roda esse
// job agora", que é exatamente o que este comando faz — pelo mesmo caminho que
// a rota interna usa, sem ledger.

import { FastifyBaseLogger } from 'fastify'
import { database } from '../database'
import { isJobName, jobNames, jobRegistry } from './registry'
import { executarJob } from './runner'

function formatar(primeiro: unknown, segundo?: unknown): string {
  if (typeof primeiro === 'string') {
    return primeiro
  }

  if (typeof segundo === 'string') {
    return `${segundo} ${JSON.stringify(primeiro)}`
  }

  return JSON.stringify(primeiro)
}

// pino aceita (msg) e (obj, msg); o shim cobre os dois formatos.
const log = {
  info: (a: unknown, b?: unknown) => console.log(formatar(a, b)),
  warn: (a: unknown, b?: unknown) => console.warn(formatar(a, b)),
  error: (a: unknown, b?: unknown) => console.error(formatar(a, b)),
  debug: (a: unknown, b?: unknown) => console.debug(formatar(a, b)),
  trace: () => undefined,
  fatal: (a: unknown, b?: unknown) => console.error(formatar(a, b)),
  silent: () => undefined,
  child: () => log,
  level: 'info',
} as unknown as FastifyBaseLogger

function uso(): never {
  console.error('\nUso: npm run job:run -- <nome-do-job>\n')
  console.error('Jobs disponíveis:\n')
  for (const nome of jobNames) {
    console.error(`  ${nome}`)
    console.error(`      ${jobRegistry[nome].description}`)
  }
  console.error('')
  process.exit(1)
}

async function main() {
  const nome = process.argv[2]

  if (!nome || !isJobName(nome)) {
    if (nome) {
      console.error(`\n❌ Job desconhecido: ${nome}`)
    }
    uso()
  }

  try {
    const resultado = await executarJob({ name: nome, log })
    console.log(`\n${JSON.stringify(resultado, null, 2)}\n`)
  } finally {
    await database.pool.end()
  }
}

main().catch((error) => {
  console.error('\n💥 Job falhou:', error)
  process.exit(1)
})
