// Confere a cópia comparando o MD5 do arquivo local com o que o Supabase
// serve na URL pública, para o mesmo conjunto que o 02 envia (dinâmicos +
// estáticos, sem images/salas/). É a evidência do CA-4 da spec 01 e trava
// obrigatória antes do cutover.
// Ver docs/manual-migracao-s3-supabase.md, passo 4.
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

expand(config({ path: '.env' }))

const ORIGEM = 'export-s3'
const DESCARTE = ['images/salas']
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'reservas-assets'
const BASE = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

const md5 = (b) => createHash('md5').update(b).digest('hex')

async function listar(dir) {
  const saida = []
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) saida.push(...(await listar(caminho)))
    else saida.push(caminho)
  }
  return saida
}

const chaveDe = (arquivo) => relative(ORIGEM, arquivo).split('\\').join('/')

const arquivos = (await listar(ORIGEM)).filter(
  (arquivo) =>
    !DESCARTE.some((prefixo) => chaveDe(arquivo).startsWith(`${prefixo}/`)),
)
const divergencias = []
let ok = 0

for (const arquivo of arquivos) {
  const chave = chaveDe(arquivo)
  const local = await readFile(arquivo)
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
  ok++
  process.stdout.write(`\r  conferidos ${ok}/${arquivos.length}`)
}

console.log(`\n${ok}/${arquivos.length} OK, ${divergencias.length} divergências`)
divergencias.forEach((d) => console.error(`  ✗ ${d.chave}: ${d.motivo}`))
process.exit(divergencias.length ? 1 : 0)
