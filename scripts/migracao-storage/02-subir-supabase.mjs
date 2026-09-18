// Sobe para o bucket do Supabase tudo que sai do export local, exceto o
// descarte (images/salas/**): os 190 dinâmicos de images/espacos/** e os 9
// estáticos (email/*.png, 404-error.svg, og-1800x1600-bbz.png). A chave é
// preservada byte a byte, então a base pública do Supabase substitui a do S3
// sem reescrever caminho em lugar nenhum.
// Idempotente: pode rodar de novo para o sync incremental antes do cutover.
// Ver docs/manual-migracao-s3-supabase.md, passo 3.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

expand(config({ path: '.env' }))

const ORIGEM = 'export-s3'
// Único grupo que não migra: órfão no banco, 3 arquivos de 0 byte e 9
// duplicatas de images/espacos/. Fica no arquivo morto do S3.
const DESCARTE = ['images/salas']
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'reservas-assets'

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
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

// Chave POSIX relativa ao export, que é exatamente a chave no bucket.
const chaveDe = (arquivo) => relative(ORIGEM, arquivo).split('\\').join('/')

const arquivos = (await listar(ORIGEM)).filter(
  (arquivo) =>
    !DESCARTE.some((prefixo) => chaveDe(arquivo).startsWith(`${prefixo}/`)),
)
console.log(`${arquivos.length} arquivos a enviar para ${BUCKET}`)

let ok = 0
const falhas = []
for (const arquivo of arquivos) {
  const chave = chaveDe(arquivo)
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
