// scripts/jobs/check-registry.mjs
//
// O nome de um job é contrato entre quatro lugares: jobs.job_definition.name,
// cron.job.jobname, a chave do registry em TypeScript e o :name da rota.
// Divergir não quebra a compilação — quebra o disparo, em silêncio, de
// madrugada. Este script compara duas dessas pontas sem precisar de banco:
// a lista esperada abaixo e o que a migration de runtime declara.
//
// Roda no CI, antes do build.
//
//   node scripts/jobs/check-registry.mjs

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const REGISTRY = join(RAIZ, 'src/infra/jobs/registry.ts')
const MIGRATIONS = join(RAIZ, 'supabase/migrations')

/** Os sete jobs de negócio. Job de runtime é SQL e não passa pelo registry. */
const ESPERADOS = [
  'attendance-status-updater',
  'cleanup-expired-pre-reservations',
  'cleanup-expired-reservations',
  'email-notification-data-collector',
  'weekly-compliance-friday-report',
  'weekly-compliance-wednesday-reminder',
  'weekly-early-checkout-monday-reminder',
]

function lerChavesDoRegistry() {
  const fonte = readFileSync(REGISTRY, 'utf8')
  const corpo = fonte.slice(
    fonte.indexOf('export const jobRegistry'),
    fonte.indexOf('} satisfies'),
  )

  return [...corpo.matchAll(/^\s{2}'([a-z0-9-]+)':/gm)].map((m) => m[1]).sort()
}

function lerNomesHttpDaMigration() {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((nome) => nome.endsWith('_jobs_runtime.sql'))
    .sort()
    .pop()

  if (!arquivo) {
    throw new Error('migration *_jobs_runtime.sql não encontrada')
  }

  const sql = readFileSync(join(MIGRATIONS, arquivo), 'utf8')

  return [...sql.matchAll(/\('([a-z0-9-]+)', 'http',/g)].map((m) => m[1]).sort()
}

function comparar(rotulo, obtidos) {
  const faltando = ESPERADOS.filter((nome) => !obtidos.includes(nome))
  const sobrando = obtidos.filter((nome) => !ESPERADOS.includes(nome))

  if (faltando.length === 0 && sobrando.length === 0) {
    console.log(`✅ ${rotulo}: ${obtidos.length} jobs, todos conferem`)
    return true
  }

  console.error(`❌ ${rotulo} divergiu da lista esperada`)
  if (faltando.length) console.error(`   faltando: ${faltando.join(', ')}`)
  if (sobrando.length) console.error(`   sobrando: ${sobrando.join(', ')}`)
  return false
}

const okRegistry = comparar('registry.ts', lerChavesDoRegistry())
const okMigration = comparar('jobs_runtime.sql', lerNomesHttpDaMigration())

if (!okRegistry || !okMigration) {
  console.error(
    '\nO nome do job precisa ser a mesma string no registry, na migration e na rota.\n',
  )
  process.exit(1)
}
