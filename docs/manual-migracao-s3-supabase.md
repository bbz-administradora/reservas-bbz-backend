# Manual de migração — AWS S3 → Supabase Storage + `public/` do front

**Sistema:** Reservas BBZ (`reservas-bbz-backend` + `reservas-bbz-frontend`)
**Spec de referência:** `reservas-bbz-backend/docs/specs/01-migracao-s3-supabase-storage/`
**Elaborado em:** 17/09/2026

Este manual é o procedimento operacional. Ele exporta, separa, copia e confere os arquivos. **Ele não altera o código da aplicação** — isso é a spec. Os dois se encontram na Fase 4 (cutover), e o manual diz exatamente onde.

> **Regra de ouro:** nada neste manual apaga arquivo no S3. A cópia é aditiva. Até o passo 7, desfazer é trocar uma variável de ambiente de volta.

---

## 1. O que vai para onde

O bucket `gestao-bbz-app-assets` tem **213 objetos, 1,86 MB**. Eles se dividem em três destinos:

| Grupo | Qtd | Tamanho | Destino | Por quê |
| --- | --- | --- | --- | --- |
| **Dinâmicos** — `images/espacos/**` | **190** | 1.496 KB | Supabase Storage, bucket `reservas-assets` | Gravados pelo back-end em runtime; referenciados no banco |
| **Estáticos** — `email/*` e raiz | **9** | 173 KB | `reservas-bbz-frontend/public/` | Nome fixo em código, nunca mudam; pertencem ao repositório |
| **Descarte** — `images/salas/**` + 2 marcadores | **14** | 191 KB | Ficam só no arquivo morto do S3 | Zero referências no banco; 3 são arquivos de 0 byte |

### Os 190 dinâmicos

```
images/espacos/            52 arquivos .webp   (29 referenciados em spaces.imagens)
images/espacos/qrcode/    138 arquivos .png    (138 referenciados em spaces.qrcode_url)
```

**A chave não muda.** `images/espacos/qrcode/qrcode-espaco-bbz-<id>.png` no S3 vira exatamente `images/espacos/qrcode/qrcode-espaco-bbz-<id>.png` no Supabase. É isso que dispensa qualquer `UPDATE` no banco.

> Os 23 arquivos de `images/espacos/` sem referência no banco **são migrados mesmo assim**. Esse é o prefixo ativo de escrita — um arquivo sem referência ali pode ser upload recente cuja associação ainda não foi salva. Já `images/salas/` não recebe escrita desde maio/2025, por isso é descarte.

### Os 9 estáticos

```
404-error.svg                         →  public/404-error.svg
og-1800x1600-bbz.png                  →  public/og-1800x1600-bbz.png
email/logo-horizontal-primary.png     →  public/email/logo-horizontal-primary.png
email/facebook-icon-email.png         →  public/email/facebook-icon-email.png
email/instagram-icon-email.png        →  public/email/instagram-icon-email.png
email/website-icon-email.png          →  public/email/website-icon-email.png
email/mail-icon-email.png             →  public/email/mail-icon-email.png
email/whatsapp-icon-email.png         →  public/email/whatsapp-icon-email.png
email/call-icon-email.png             →  public/email/call-icon-email.png
```

> `call-icon-email.png` não é referenciado por nenhum componente de e-mail hoje. Migre junto (é 1 KB) e decida depois se apaga.

### Os 14 de descarte

`images/salas/` tem 12 arquivos: 3 com 0 byte (`sala-presidencia-*`) e 9 que são cópia byte a byte de arquivos já presentes em `images/espacos/`. Mais os 2 marcadores de pasta de 0 byte (`email/`, `images/espacos/`), artefato do console da AWS — o Supabase Storage não tem esse conceito.

---

## 2. Antes de começar

### Ambiente já provisionado

O bucket de destino **já foi criado** no projeto `gestao_reservas_copy`:

| Item | Valor |
| --- | --- |
| Projeto Supabase | `gestao_reservas_copy` — ref `kpwxmtqmzzybaolhijxb` |
| API URL | `https://kpwxmtqmzzybaolhijxb.supabase.co` |
| Bucket | `reservas-assets` |
| Visibilidade | Público (leitura anônima) |
| Limite por arquivo | 5 MB |
| MIME permitidos | `image/webp`, `image/png`, `image/jpeg` |
| Policy | `reservas_assets_public_read` (`select` para `anon` e `authenticated`) |
| Migration | `create_reservas_assets_storage_bucket` |
| **Base pública** | `https://kpwxmtqmzzybaolhijxb.supabase.co/storage/v1/object/public/reservas-assets` |

Não existe policy de `insert`, `update` ou `delete` — de propósito. Só a `service_role` escreve.

> **Para produção:** rode a mesma migration no projeto de produção antes da Fase 5 da spec. O SQL está no Anexo B.

### O que você precisa ter em mãos

1. **Node 22** (já é o engine do projeto).
2. **`.env` do back-end preenchido** com as credenciais S3 atuais — os scripts leem `PUBLIC_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` de lá.
3. **A `service_role` key do Supabase.** Pegue em: Dashboard → projeto `gestao_reservas_copy` → *Project Settings* → *API Keys* → `service_role`.

   > Essa chave ignora RLS em **todo** o projeto, não só no storage. Ela não entra no git, não vai para o `.env.example` e, em produção, vive apenas como Secret File no Render (`/etc/secrets/.env.prod`).

4. **Dependência do Supabase instalada** no back-end:

```bash
npm install @supabase/supabase-js
```

5. **Duas linhas acrescentadas ao `.env`** do back-end (só para rodar os scripts; a spec formaliza isso no `env.ts` na Fase 2):

```
SUPABASE_URL=https://kpwxmtqmzzybaolhijxb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=cole_a_service_role_key_aqui
SUPABASE_STORAGE_BUCKET=reservas-assets
```

### Onde colocar os scripts

Crie a pasta `scripts/migracao-storage/` na raiz do `reservas-bbz-backend`. Os três scripts deste manual vão lá. Eles precisam rodar de dentro do repositório para enxergar o `node_modules`.

```bash
mkdir -p scripts/migracao-storage
```

---

## 3. Passo 1 — Exportar tudo do S3 (backup + fonte da cópia)

Este passo baixa **os 213 objetos**, inclusive o descarte. O resultado é o seu backup completo e é também a fonte da cópia dos passos seguintes — copiar a partir de arquivo local torna o processo re-executável sem depender do S3 estar de pé.

**`scripts/migracao-storage/01-exportar-s3.mjs`**

```js
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
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
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
  objetos.push(...(r.Contents ?? []))
  token = r.NextContinuationToken
} while (token)

console.log(`Bucket ${bucket}: ${objetos.length} objetos`)

let ok = 0
let pulados = 0
for (const obj of objetos) {
  if (obj.Key.endsWith('/')) {
    pulados++
    continue // marcador de pasta do console da AWS
  }
  const destino = join(DESTINO, obj.Key)
  await mkdir(dirname(destino), { recursive: true })
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }))
  await writeFile(destino, Buffer.from(await r.Body.transformToByteArray()))
  ok++
  process.stdout.write(`\r  baixados ${ok}`)
}

console.log(`\nOK: ${ok} arquivos em ./${DESTINO}/ | marcadores ignorados: ${pulados}`)
```

Rode:

```bash
node scripts/migracao-storage/01-exportar-s3.mjs
```

**Esperado:** `OK: 211 arquivos em ./export-s3/ | marcadores ignorados: 2`

Confira a estrutura:

```bash
find export-s3 -type f | wc -l
```

Deve dar **211** (190 dinâmicos + 9 estáticos + 12 de `images/salas/`).

> **Guarde `export-s3/` fora do repositório** quando terminar — é o seu backup. Acrescente `export-s3/` ao `.gitignore` antes de qualquer commit.

---

## 4. Passo 2 — Estáticos para o `public/` do front

Nenhum script: são 9 arquivos, entram no git.

```bash
cd ../reservas-bbz-frontend
mkdir -p public/email
cp ../reservas-bbz-backend/export-s3/404-error.svg           public/
cp ../reservas-bbz-backend/export-s3/og-1800x1600-bbz.png    public/
cp ../reservas-bbz-backend/export-s3/email/*.png             public/email/
```

Confira que são 9 e commite:

```bash
find public/404-error.svg public/og-1800x1600-bbz.png public/email -type f | wc -l   # 9
git add public/404-error.svg public/og-1800x1600-bbz.png public/email
git commit -m "chore: trazer assets estáticos do S3 para o public/"
```

Publique o front e **valide que os arquivos estão servidos**:

```bash
curl -I https://app-sistema-reserva.bbz.com.br/email/logo-horizontal-primary.png
curl -I https://app-sistema-reserva.bbz.com.br/404-error.svg
```

Os dois precisam responder `200` com `content-type` de imagem. Se responderem `401`, `302` ou HTML, o front está protegendo o `public/` — nesse caso **pare** e use o plano B da hipótese H-2 da spec (criar um prefixo `assets/` no bucket Supabase e apontar `ASSETS_BASE_URL` para lá).

> Só depois desse `200` é seguro trocar as 6 referências nos componentes de e-mail (`FooterEmail.tsx` e `HeaderEmail.tsx`) de `PUBLIC_BUCKET` para `ASSETS_BASE_URL`. Isso é código — está na Fase 3 da spec.

---

## 5. Passo 3 — Copiar os 190 dinâmicos para o Supabase

**`scripts/migracao-storage/02-subir-supabase.mjs`**

```js
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

expand(config({ path: '.env' }))

const ORIGEM = 'export-s3'
const PREFIXO = 'images/espacos' // só o que é dinâmico
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'reservas-assets'

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

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
  const chave = relative(ORIGEM, arquivo).split('\\').join('/') // Windows → chave POSIX
  const ext = chave.slice(chave.lastIndexOf('.')).toLowerCase()
  const buffer = await readFile(arquivo)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(chave, buffer, { contentType: MIME[ext] ?? 'application/octet-stream', upsert: true })

  if (error) falhas.push({ chave, erro: error.message })
  else ok++
  process.stdout.write(`\r  enviados ${ok}/${arquivos.length}`)
}

console.log(`\nOK: ${ok} | Falhas: ${falhas.length}`)
falhas.forEach((f) => console.error(`  ✗ ${f.chave}: ${f.erro}`))
process.exit(falhas.length ? 1 : 0)
```

Rode:

```bash
node scripts/migracao-storage/02-subir-supabase.mjs
```

**Esperado:** `190 arquivos a enviar` … `OK: 190 | Falhas: 0`

O script é **idempotente** (`upsert: true`). Pode rodar de novo à vontade — é exatamente assim que você fará o `sync` incremental antes do cutover.

### Pontos de atenção

| Sintoma | Causa | O que fazer |
| --- | --- | --- |
| `new row violates row-level security policy` | Você usou a `anon`/`publishable` key, não a `service_role` | Confira `SUPABASE_SERVICE_ROLE_KEY` |
| `mime type ... is not supported` | Extensão fora de webp/png/jpeg | Confira o arquivo; o bucket restringe MIME de propósito |
| `The object exceeded the maximum allowed size` | Arquivo acima de 5 MB | Não deve ocorrer: o maior objeto atual tem 112 KB |
| Chave com `\` no Supabase | Caminho do Windows não convertido | O `.split('\\').join('/')` do script trata; se editar, preserve |

---

## 6. Passo 4 — Conferir a cópia (obrigatório antes do cutover)

Compara **MD5 byte a byte** entre o arquivo local e o que o Supabase serve na URL pública. É a evidência do CA-4 da spec.

**`scripts/migracao-storage/03-verificar.mjs`**

```js
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

expand(config({ path: '.env' }))

const ORIGEM = 'export-s3'
const PREFIXO = 'images/espacos'
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

const arquivos = await listar(join(ORIGEM, PREFIXO))
const divergencias = []
let ok = 0

for (const arquivo of arquivos) {
  const chave = relative(ORIGEM, arquivo).split('\\').join('/')
  const local = await readFile(arquivo)
  const resposta = await fetch(`${BASE}/${chave}`)

  if (!resposta.ok) {
    divergencias.push({ chave, motivo: `HTTP ${resposta.status}` })
    continue
  }
  const remoto = Buffer.from(await resposta.arrayBuffer())
  if (md5(local) !== md5(remoto)) {
    divergencias.push({ chave, motivo: `MD5 difere (${local.length}B local × ${remoto.length}B remoto)` })
    continue
  }
  ok++
  process.stdout.write(`\r  conferidos ${ok}/${arquivos.length}`)
}

console.log(`\n${ok}/${arquivos.length} OK, ${divergencias.length} divergências`)
divergencias.forEach((d) => console.error(`  ✗ ${d.chave}: ${d.motivo}`))
process.exit(divergencias.length ? 1 : 0)
```

Rode:

```bash
node scripts/migracao-storage/03-verificar.mjs
```

**Critério de aprovação:** `190/190 OK, 0 divergências`. Qualquer número diferente **interrompe a migração aqui**. Nada apontou para o Supabase ainda, então parar neste ponto não tem impacto nenhum em produção.

### Conferência no banco (SQL)

Confirma que toda chave citada em `spaces` existe no bucket novo. Rode no SQL Editor do projeto:

```sql
-- Deve retornar ZERO linhas.
with referencias as (
  select qrcode_url as chave from spaces where qrcode_url is not null
  union
  select i from spaces s, jsonb_array_elements_text(s.imagens) i
)
select r.chave as faltando_no_bucket
from referencias r
left join storage.objects o
  on o.bucket_id = 'reservas-assets' and o.name = r.chave
where o.id is null;
```

E o retrato de controle do OBJ-2 / CA-5 — **rode antes e depois** da migração e compare:

```sql
select
  count(*)                                as espacos,
  count(qrcode_url)                       as com_qrcode,
  sum(jsonb_array_length(imagens))        as refs_imagem,
  max(updated_at)                         as ultima_alteracao
from spaces;
```

Referência medida em 17/09/2026 em `gestao_reservas_copy`: **131 espaços, 131 com QR code, 29 referências de imagem.** Os quatro valores precisam ser idênticos depois. Se `ultima_alteracao` mudou, algo escreveu no banco — investigue antes de seguir.

---

## 7. Passo 5 — Cutover

Aqui o manual encontra a spec. **A ordem importa:** leitura muda antes da escrita. Se a escrita mudar primeiro, existe uma janela em que o back-end grava onde o front ainda não lê, e imagens novas somem.

### 5a. Sync incremental

Entre o passo 3 e agora, novos QR codes e uploads podem ter entrado no S3. Recapture:

```bash
node scripts/migracao-storage/01-exportar-s3.mjs
node scripts/migracao-storage/02-subir-supabase.mjs
node scripts/migracao-storage/03-verificar.mjs
```

Os três são re-executáveis. O verificador precisa fechar em `0 divergências`.

### 5b. Front passa a LER do Supabase

Em `reservas-bbz-frontend`, altere a variável de ambiente:

```diff
- NEXT_PUBLIC_BUCKET=https://gestao-bbz-app-assets.s3.us-east-1.amazonaws.com
+ NEXT_PUBLIC_BUCKET=https://kpwxmtqmzzybaolhijxb.supabase.co/storage/v1/object/public/reservas-assets
```

> **Sem barra no fim.** O front monta as URLs como `${NEXT_PUBLIC_BUCKET}/${caminho}`, com a barra no template.

**Correção obrigatória em `next.config.mjs`.** O arquivo hoje deriva o hostname assim:

```js
hostname: `${process.env.NEXT_PUBLIC_BUCKET.replace('https://', '')}`,
```

Com o valor novo, que contém caminho, isso produziria o hostname `kpwxmtqmzzybaolhijxb.supabase.co/storage/v1/object/public/reservas-assets` e o `next/image` recusaria **todas** as imagens. Troque por:

```js
const bucketUrl = new URL(process.env.NEXT_PUBLIC_BUCKET)

// dentro de images.remotePatterns:
{
  protocol: 'https',
  hostname: bucketUrl.hostname,
  pathname: `${bucketUrl.pathname}/**`,
}
```

Publique o front e **confirme visualmente**: abra a listagem de espaços, um espaço com galeria e a tela de QR code. As imagens têm de carregar. Se falharem, volte `NEXT_PUBLIC_BUCKET` para o S3 — o back-end ainda está gravando lá, nada se perdeu.

### 5c. Back-end passa a ESCREVER no Supabase

Só depois de 5b confirmado. No Render, no Secret File `/etc/secrets/.env.prod`:

```diff
+ STORAGE_DRIVER=supabase
+ SUPABASE_URL=https://kpwxmtqmzzybaolhijxb.supabase.co
+ SUPABASE_SERVICE_ROLE_KEY=<service_role>
+ SUPABASE_STORAGE_BUCKET=reservas-assets
+ ASSETS_BASE_URL=https://app-sistema-reserva.bbz.com.br
```

Reinicie o serviço. O log de boot informa o driver ativo e o bucket — é a confirmação do cutover.

### 5d. Teste de fumaça

| # | Ação | Esperado |
| --- | --- | --- |
| 1 | Subir imagem nova em um espaço | `201`; objeto aparece em `storage.objects`; imagem renderiza |
| 2 | Gerar QR code de espaço sem `qrcode_url` | PNG no bucket; `qrcode_url` salvo como **caminho relativo** |
| 3 | Excluir uma imagem de teste | `200`; objeto some do bucket |
| 4 | Disparar e-mail transacional | Logo e os 5 ícones do rodapé renderizam no Gmail e no Outlook |
| 5 | Rodar o SQL de controle do §6 | Mesmos 4 valores de antes (fora os do teste 1 e 2) |

---

## 8. Passo 6 — Rollback

Durante toda a janela de observação (7 dias), voltar é troca de variável de ambiente. **Sem deploy, sem migration, sem tocar no banco.**

| Ordem | Onde | Ação |
| --- | --- | --- |
| 1 | Back-end (Render) | `STORAGE_DRIVER=s3` + restart → volta a gravar no S3 |
| 2 | Front | `NEXT_PUBLIC_BUCKET` de volta para a URL do S3 + publicar |
| 3 | — | Recuperar o que foi gravado no Supabase durante a janela (ver abaixo) |

O passo 3 é o único trabalhoso, e é o motivo de a janela ser curta. Para achar o que entrou no Supabase depois do cutover:

```sql
select name, created_at
from storage.objects
where bucket_id = 'reservas-assets'
  and created_at > '<timestamp do cutover>'
order by created_at;
```

Baixe essas chaves pela URL pública e suba no S3 com a chave idêntica.

---

## 9. Passo 7 — Desligar o S3 (só após 7 dias limpos)

**Não execute antes de:**

1. 7 dias corridos sem tráfego de leitura no bucket (CloudWatch → S3 → `GetRequests`). É o OBJ-3 da spec.
2. Busca por `gestao-bbz-app-assets` nos demais repositórios BBZ, confirmando que ninguém mais lê esse bucket.
3. `export-s3/` guardado fora do repositório, em local com backup.

Então, nesta ordem:

1. **Glacier por 90 dias**, não exclusão. Aplique uma lifecycle rule movendo tudo para Glacier Deep Archive. O bucket ainda guarda os 12 órfãos de `images/salas/`, que nunca foram migrados.
2. **Revogue as credenciais** `S3_ACCESS_KEY` / `S3_SECRET_KEY` no IAM.
3. **Limpe o código** (Fase 5 da spec): remover `src/repositories/s3/`, `src/lib/aws/`, `@aws-sdk/client-s3`, `STORAGE_DRIVER` e as 4 variáveis de S3 do `env.ts` e do `.env.example`.
4. **Exclua o bucket** só depois dos 90 dias.

---

## Anexo A — Alternativa para volumes grandes (`rclone`)

Os scripts acima são adequados a 190 arquivos de 1,5 MB. Para migrações futuras com dezenas de milhares de objetos, o Supabase expõe um **endpoint S3-compatível**, o que permite copiar S3 → Supabase direto, sem passar por disco local, com retomada e verificação de hash embutidas.

1. Dashboard → *Storage* → *Configuration* → *S3* → habilite o protocolo e **gere um par de chaves** (mostrado uma única vez).
2. Endpoint: `https://kpwxmtqmzzybaolhijxb.storage.supabase.co/storage/v1/s3`, região `us-east-1`, `path-style` obrigatório.

```bash
rclone copy \
  s3aws:gestao-bbz-app-assets/images/espacos \
  s3supa:reservas-assets/images/espacos \
  --checksum --progress
```

Com dois remotes configurados no `rclone.conf` (`provider = Other`, `force_path_style = true` no lado Supabase).

> As chaves S3 do Supabase têm acesso total a todos os buckets do projeto e ignoram RLS. Trate como a `service_role`.

---

## Anexo B — SQL de provisionamento do bucket

Já aplicado em `gestao_reservas_copy`. Rode isto no projeto de **produção** antes da Fase 5.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reservas-assets',
  'reservas-assets',
  true,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "reservas_assets_public_read" on storage.objects;
create policy "reservas_assets_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'reservas-assets');

-- Sem policy de insert/update/delete: a escrita é exclusiva da service_role.
```

---

## Anexo C — Checklist de execução

```
PREPARO
[ ] npm install @supabase/supabase-js
[ ] service_role key obtida no dashboard
[ ] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET no .env
[ ] export-s3/ adicionado ao .gitignore
[ ] SQL de controle rodado e valores anotados (131 / 131 / 29 / updated_at)

EXPORTAÇÃO
[ ] 01-exportar-s3.mjs → 211 arquivos, 2 marcadores ignorados

ESTÁTICOS
[ ] 9 arquivos copiados para reservas-bbz-frontend/public/
[ ] commit + publicação do front
[ ] curl -I devolve 200 nos dois assets           ← trava a hipótese H-2
[ ] 6 referências de e-mail trocadas para ASSETS_BASE_URL (código, Fase 3 da spec)

DINÂMICOS
[ ] 02-subir-supabase.mjs → OK: 190 | Falhas: 0
[ ] 03-verificar.mjs → 190/190 OK, 0 divergências  ← trava obrigatória
[ ] SQL anti-join → zero linhas

CUTOVER
[ ] sync incremental (01 → 02 → 03) fecha em 0 divergências
[ ] next.config.mjs corrigido (hostname via new URL)
[ ] NEXT_PUBLIC_BUCKET apontado para o Supabase + publicado
[ ] imagens confirmadas visualmente no front
[ ] STORAGE_DRIVER=supabase + vars no Render, restart
[ ] log de boot mostra driver supabase
[ ] teste de fumaça 1 a 5 aprovado
[ ] SQL de controle bate com o anotado no preparo

OBSERVAÇÃO (7 dias)
[ ] tráfego de leitura do S3 zerado
[ ] busca por gestao-bbz-app-assets nos outros repositórios: nada

DESLIGAMENTO
[ ] export-s3/ arquivado fora do repositório
[ ] lifecycle rule → Glacier Deep Archive
[ ] credenciais S3 revogadas no IAM
[ ] limpeza de código (Fase 5 da spec)
[ ] exclusão do bucket após 90 dias
```
