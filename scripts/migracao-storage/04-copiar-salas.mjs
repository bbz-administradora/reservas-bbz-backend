// Copia os 12 objetos de images/salas/ para o bucket do Supabase — o grupo que
// a spec 01 classificou como descarte e que o 02 deixa de fora de propósito.
// Pedido depois da migração, como cópia de arquivamento: o S3 vai para Glacier
// e depois some, e a decisão foi guardar esses arquivos junto com o resto.
//
// Não altera os 02/03: eles continuam representando o conjunto em uso (199).
// Este script é o registro de que os 12 entraram por outro motivo.
//
// Idempotente (upsert) e confere MD5 do que subiu.
//
// Alvo: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY do ambiente. Para rodar contra
// um ambiente que não é o do .env, passe as duas na linha de comando:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migracao-storage/04-copiar-salas.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

// O ambiente explícito ganha do .env, senão não dá para mirar em produção.
const doAmbiente = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET,
}
expand(config({ path: '.env' }))

const URL = doAmbiente.url ?? process.env.SUPABASE_URL
const KEY = doAmbiente.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET =
  doAmbiente.bucket ?? process.env.SUPABASE_STORAGE_BUCKET ?? 'reservas-assets'

const ORIGEM = join('export-s3', 'images', 'salas')
const PREFIXO = 'images/salas'

if (!URL || !KEY) {
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const md5 = (b) => createHash('md5').update(b).digest('hex')
const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

const arquivos = (await readdir(ORIGEM, { withFileTypes: true }))
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .sort()

console.log(`Alvo:   ${URL}`)
console.log(`Bucket: ${BUCKET}`)
console.log(`${arquivos.length} arquivos em ${PREFIXO}/\n`)

let enviados = 0
const falhas = []

for (const nome of arquivos) {
  const chave = `${PREFIXO}/${nome}`
  const buffer = await readFile(join(ORIGEM, nome))

  const { error } = await supabase.storage.from(BUCKET).upload(chave, buffer, {
    contentType: 'image/webp', // os 12 são .webp
    upsert: true,
  })

  if (error) {
    falhas.push({ chave, motivo: error.message })
    console.error(`  x ${nome}: ${error.message}`)
    continue
  }
  enviados++
  console.log(`  + ${nome} (${buffer.length}B)`)
}

console.log(`\nEnviados ${enviados}/${arquivos.length}. Conferindo MD5...\n`)

const BASE = `${URL}/storage/v1/object/public/${BUCKET}`
const divergencias = []
let conferidos = 0

for (const nome of arquivos) {
  const chave = `${PREFIXO}/${nome}`
  const local = await readFile(join(ORIGEM, nome))
  const resposta = await fetch(`${BASE}/${chave}`)

  if (!resposta.ok) {
    divergencias.push({ chave, motivo: `HTTP ${resposta.status}` })
    continue
  }
  const remoto = Buffer.from(await resposta.arrayBuffer())
  if (md5(local) !== md5(remoto)) {
    divergencias.push({
      chave,
      motivo: `MD5 difere (${local.length}B local x ${remoto.length}B remoto)`,
    })
    continue
  }
  conferidos++
}

console.log(
  `${conferidos}/${arquivos.length} conferidos, ${divergencias.length} divergências`,
)
divergencias.forEach((d) => console.error(`  x ${d.chave}: ${d.motivo}`))
process.exit(falhas.length || divergencias.length ? 1 : 0)
