// Sobe os objetos dinâmicos (images/espacos/**) do export local para o bucket
// do Supabase, preservando a chave. Idempotente: pode rodar de novo para fazer
// o sync incremental antes do cutover.
// Ver docs/manual-migracao-s3-supabase.md, passo 3.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

expand(config({ path: '.env' }))

const ORIGEM = 'export-s3'
const PREFIXO = 'images/espacos' // só o que é dinâmico; images/salas não migra
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'reservas-assets'

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function listar(dir) {
  const saida = []
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) saida.push(...(await listar(caminho)))
    else saida.push(caminho)
  }
  return saida
}

const arquivos = await listar(join(ORIGEM, PREFIXO))
console.log(`${arquivos.length} arquivos a enviar para ${BUCKET}`)

let ok = 0
const falhas = []
for (const arquivo of arquivos) {
  const chave = relative(ORIGEM, arquivo).split('\\').join('/') // Windows -> POSIX
  const ext = chave.slice(chave.lastIndexOf('.')).toLowerCase()
  const buffer = await readFile(arquivo)

  const { error } = await supabase.storage.from(BUCKET).upload(chave, buffer, {
    contentType: MIME[ext] ?? 'application/octet-stream',
    upsert: true,
  })

  if (error) falhas.push({ chave, erro: error.message })
  else ok++
  process.stdout.write(`\r  enviados ${ok}/${arquivos.length}`)
}

console.log(`\nOK: ${ok} | Falhas: ${falhas.length}`)
falhas.forEach((f) => console.error(`  ✗ ${f.chave}: ${f.erro}`))
process.exit(falhas.length ? 1 : 0)
