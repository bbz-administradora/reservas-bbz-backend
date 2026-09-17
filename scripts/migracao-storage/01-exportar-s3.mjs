// Exporta todos os objetos do bucket S3 para ./export-s3/, preservando a
// estrutura de chaves. É o backup da migração e a fonte dos passos seguintes.
// Ver docs/manual-migracao-s3-supabase.md, passo 1.
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

expand(config({ path: '.env' }))

const DESTINO = 'export-s3'
const bucket = process.env.PUBLIC_BUCKET.match(/^https?:\/\/([^.]+)\./)[1]
const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
})

let token
const objetos = []
do {
  const r = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
  )
  objetos.push(...(r.Contents ?? []))
  token = r.NextContinuationToken
} while (token)

console.log(`Bucket ${bucket}: ${objetos.length} objetos`)

let ok = 0
let pulados = 0
for (const obj of objetos) {
  if (obj.Key.endsWith('/')) {
    pulados++
    continue // marcador de pasta do console da AWS, não é conteúdo
  }
  const destino = join(DESTINO, obj.Key)
  await mkdir(dirname(destino), { recursive: true })
  const r = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: obj.Key }),
  )
  await writeFile(destino, Buffer.from(await r.Body.transformToByteArray()))
  ok++
  process.stdout.write(`\r  baixados ${ok}`)
}

console.log(
  `\nOK: ${ok} arquivos em ./${DESTINO}/ | marcadores ignorados: ${pulados}`,
)
