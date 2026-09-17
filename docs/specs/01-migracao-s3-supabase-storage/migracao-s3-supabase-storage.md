# Migrar o storage de imagens do AWS S3 para o Supabase Storage sem reescrever o banco

Status: Implementation Ready
Complexidade: M
Responsável: Matheus Galdino
Versão: 1.0
Atualizado em: 2026-09-17

## 0. Pontos para revisão

1. **A chave do objeto não muda.** O banco guarda caminho relativo (`images/espacos/...`) em 131 linhas de `spaces`, nunca URL absoluta. Preservando o layout de chaves no bucket novo, a migração não escreve uma única linha no banco — o cutover é troca de variável de ambiente. Isso é o que torna o rollback trivial e é a decisão que sustenta todo o resto da spec.
2. **A `IStorageAdapter` já é compatível com o Supabase; o que está quebrado é o uso dela.** A interface não muda em nenhuma assinatura. O impedimento real é que as use cases tipam contra a classe concreta `S3StorageAdapter` (§2), então hoje não existe ponto de troca. Corrigir esse acoplamento é a Fase 1 e é pré-requisito de tudo.
3. **Dois defeitos pré-existentes aparecem no caminho e precisam de decisão**: o endpoint de delete aceita qualquer caminho do bucket sem restrição de prefixo nem de dono (RB-3), e o front referencia dois arquivos de Open Graph que não existem no bucket (§8). Nenhum dos dois é causado por esta migração; ambos ficam mais baratos de corrigir durante ela.

## 1. Resumo

O back-end grava e apaga imagens em um bucket S3 (`gestao-bbz-app-assets`) através de um único adapter. O objetivo é passar esse armazenamento para o Supabase Storage, consolidando a infraestrutura no Supabase que já hospeda o banco, sem interromper o serviço e sem reescrever referências no banco.

A solução: implementar um segundo adapter (`SupabaseStorageAdapter`) sobre a interface `IStorageAdapter` que já existe, corrigir o acoplamento que hoje impede a troca, e fazer o cutover por variável de ambiente. Os 190 objetos dinâmicos (imagens de espaço e QR codes) vão para um bucket público do Supabase com as chaves idênticas; os 9 objetos estáticos (ícones de e-mail, SVG de erro, imagem de Open Graph) saem do storage e passam a ser versionados no `public/` do front.

Resultado observável: imagens de espaço, QR codes e e-mails continuam abrindo exatamente como hoje, servidos pelo Supabase e pelo front; o bucket S3 pode ser desligado sem nenhuma alteração de dados.

## 2. Contexto e evidências

### O que existe hoje

Um único cliente S3 em [src/lib/aws/s3/index.ts](../../../src/lib/aws/s3/index.ts) e um único adapter em [src/repositories/s3/s3-storage-repository.ts](../../../src/repositories/s3/s3-storage-repository.ts). Nenhum outro ponto do código importa `@aws-sdk/client-s3`.

Existe **um só bucket**. O schema de ambiente em [src/infra/env.ts:66](../../../src/infra/env.ts#L66) declara `PUBLIC_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY` e `S3_SECRET_KEY`. Não há bucket privado, não há `GetObjectCommand` e não há URL assinada — leitura é sempre por URL pública direta.

Só existem **dois produtores de objeto**:

| Produtor | Caminho gravado | Evidência |
| --- | --- | --- |
| `POST /v1/private/image/s3/upload` | `images/<folder>/<group>[-<subtitle>]-<timestamp>.webp` | [image-use-case.ts:99](../../../src/models/image/image-use-case.ts#L99) |
| Geração de QR code de espaço | `images/espacos/qrcode/qrcode-espaco-bbz-<spaceId>.png` | [space-qrcode-use-case.ts:56](../../../src/models/space/space-qrcode-use-case.ts#L56) |

O prefixo `images/` é fixo em código nos dois. O segundo nível (`espacos`, `salas`) **não** é fixo no back-end: vem do query param `folder`, declarado como `z.string().optional()` sem enum em [image-upload-schema.ts:15](../../../src/schemas/image/image-upload-schema.ts#L15). Quem escolhe o valor é o front.

### A interface existe mas ninguém depende dela

[src/repositories/base/storage-repository.ts](../../../src/repositories/base/storage-repository.ts) define `IStorageAdapter` com quatro métodos e vocabulário neutro, sem nada de AWS. `S3StorageAdapter implements IStorageAdapter`. Porém **todos os consumidores tipam contra a classe concreta**:

| Arquivo | Linha | Uso |
| --- | --- | --- |
| [image-use-case.ts:39](../../../src/models/image/image-use-case.ts#L39) | `storageRepository: S3StorageAdapter` | tipo da dependência |
| [space-qrcode-use-case.ts:22](../../../src/models/space/space-qrcode-use-case.ts#L22) | `storageRepository: S3StorageAdapter` | tipo da dependência |
| [image-upload.ts:30](../../../src/api/v1/private/image/s3/upload/image-upload.ts#L30) | `new S3StorageAdapter()` | instanciação |
| [image-delete.ts:28](../../../src/api/v1/private/image/s3/delete/image-delete.ts#L28) | `new S3StorageAdapter()` | instanciação |
| [space-qrcode.ts:27](../../../src/api/v1/private/space/qrcode/space-qrcode.ts#L27) | `new S3StorageAdapter()` | instanciação |

`IStorageAdapter` é importado em exatamente um lugar do projeto: o próprio `implements`. Isso destoa do padrão do repositório — [outpost-create-use-case.ts:9-12](../../../src/models/outpost/outpost-create-use-case.ts#L9-L12) tipa contra `IOutpostsRepository`, `ITeamPositionsRepository` e `IUserRepository`, e o mesmo vale para todas as use cases de reservation. Storage é a exceção.

**Consequência para esta task:** sem corrigir isso, não existe ponto de troca. Essa correção é a Fase 1.

### Dois métodos da interface são código morto

`deleteFiles(prefix)` e `getPublicUrl(path)` são declarados, implementados e **nunca chamados** — busca por ambos os símbolos em `src/` retorna apenas a definição na interface e a implementação no adapter. Além disso `getPublicUrl` está quebrado: concatena `${env.PUBLIC_BUCKET}${normalizedPath}` sem barra, e `PUBLIC_BUCKET` em produção não termina com `/`, então produziria `...amazonaws.comimages/foo.webp`. O front monta a URL por conta própria e nunca chama esse método.

### Inventário real do bucket

Levantado em 2026-09-17 via `ListObjectsV2` contra `gestao-bbz-app-assets`: **213 objetos, 1,86 MB no total.**

| Prefixo | Objetos | Tamanho | Natureza | Destino |
| --- | --- | --- | --- | --- |
| `images/espacos/qrcode/` | 138 | 513 KB | dinâmico, gerado pelo back-end | Supabase Storage |
| `images/espacos/` | 52 | 982 KB | dinâmico, referenciado em `spaces.imagens` | Supabase Storage |
| `images/salas/` | 12 | 191 KB | dinâmico **órfão** (ver abaixo) | **Não migra** — fica no arquivo morto do S3 |
| `email/` | 7 | 7 KB | estático, nome fixo em código | `public/` do front |
| raiz | 2 | 166 KB | estático, nome fixo em código | `public/` do front |

Observações do inventário que afetam o plano:

- **`images/salas/` é órfão.** Consulta em `spaces` retorna 29 referências de imagem, **todas** apontando para `images/espacos/*.webp`. Nenhuma linha do banco cita `images/salas/`. São arquivos de maio/2025, anteriores à padronização do `folder` para `espacos`.
- **Três objetos têm 0 byte**, todos dentro de `images/salas/`: `sala-presidencia-20250520T105218201Z.webp`, `...20250523T150449012Z.webp` e `...20250606T190226034Z.webp`. Uploads que falharam sem tratamento. Fora de `images/salas/` não há nenhum objeto vazio.
- **Há duplicatas entre prefixos.** Nove arquivos `sala-bbz-2025051*.webp` existem com nome e tamanho idênticos em `images/salas/` e `images/espacos/`.
- **Dois marcadores de pasta de 0 byte** (`email/`, `images/espacos/`), artefato do console da AWS. Não têm equivalente no Supabase Storage e não devem ser copiados.

### Como os estáticos são consumidos

Seis referências em código do back-end, todas com nome fixo, em [FooterEmail.tsx](../../../src/lib/react-mail/components/FooterEmail.tsx) (linhas 110, 126, 142, 158, 174) e [HeaderEmail.tsx:11](../../../src/lib/react-mail/components/HeaderEmail.tsx#L11), no formato `${env.PUBLIC_BUCKET}/email/<arquivo>.png`. E-mail exige URL absoluta, então esses arquivos precisam continuar acessíveis por HTTP público.

No front (`reservas-bbz-frontend`), o consumo é `${env.NEXT_PUBLIC_BUCKET}/${caminhoRelativo}`, com a barra explícita no template — [ImageGallery.tsx:34](../../../../reservas-bbz-frontend/src/components/ImageGallery.tsx#L34), [SpaceCard.tsx:44](../../../../reservas-bbz-frontend/src/components/SpaceCard.tsx#L44), [columns-spaces.tsx:591](../../../../reservas-bbz-frontend/src/components/data-table/spaces/columns-spaces.tsx#L591), [SpaceAddUpdateImageForm.tsx:506](../../../../reservas-bbz-frontend/src/components/forms/SpaceAddUpdateImageForm.tsx#L506), [espacos/[id]/page.tsx:60](../../../../reservas-bbz-frontend/src/app/\(with-layout\)/espacos/\[id\]/page.tsx#L60). Portanto **a base nova não pode terminar em barra**.

### Conflitos entre fontes

| Fontes | Divergência | Decisão afetada | Resolução/status |
| --- | --- | --- | --- |
| MCP do Supabase × `DATABASE_URL` de produção | O MCP conectado aponta por padrão para `ihatchzfxtfgudoratne` (FlowBBZ_Desenvolvimento); o `DATABASE_URL` de prod usa o ref `wnzvnmqvlmmwawnjuszo`, que não aparece na lista de projetos acessíveis pelo token | Onde provisionar o bucket | **Resolvido.** Bucket criado em `gestao_reservas_copy` (`kpwxmtqmzzybaolhijxb`), único projeto visível com o schema deste back-end. O provisionamento de produção é passo manual do manual de migração (§11, Fase 5) |
| Front × bucket S3 | [layout.tsx:29,60](../../../../reservas-bbz-frontend/src/app/layout.tsx#L29) referencia `og-800x600-bbz.png` e `og-800x600-reserva.png`; nenhum dos dois existe no bucket | Quais estáticos migrar | **Resolvido como fora de escopo** (§4). São 404 já hoje; a migração não os cria nem os piora |
| Docstring do upload × schema | A documentação do endpoint cita `establishmentId` como parâmetro ([image-upload.ts:19](../../../src/api/v1/private/image/s3/upload/image-upload.ts#L19)) | Nenhuma | Informativo. O campo existe na interface `UploadImageInput` mas não é lido pelo controller nem declarado no schema de query. Não muda com esta task |

## 3. Objetivos e métricas

- **OBJ-1**: Upload, geração de QR code e exclusão de imagem passam a operar contra o Supabase Storage, com o mesmo contrato HTTP e as mesmas respostas de hoje.
- **OBJ-2**: Nenhuma linha de `spaces` é alterada pela migração. Verificável por `count(*)` de `qrcode_url` e de elementos de `imagens` antes e depois, e por comparação de `updated_at`.
- **OBJ-3**: O bucket `gestao-bbz-app-assets` fica sem tráfego de leitura por 7 dias corridos após o cutover, medido nas métricas do CloudWatch/S3, antes de qualquer exclusão.
- **OBJ-4**: `@aws-sdk/client-s3` sai de `dependencies` ao fim do rollout.

## 4. Fora de escopo

| Item | Destino | Motivo ou dependência |
| --- | --- | --- |
| Criar `og-800x600-bbz.png` e `og-800x600-reserva.png` | Próxima entrega | Estão quebrados hoje e continuam quebrados depois; corrigir exige arte, não migração. Registrar como bug separado |
| Restringir o `folder` do upload a um enum | Próxima entrega | Reduz superfície, mas muda contrato do endpoint e exige alinhar o front. Ver RB-2 |
| Autorização por dono no delete de imagem | Próxima entrega | Defeito pré-existente de escopo maior que esta task. Ver RB-3, que trata apenas o contorno mínimo |
| Migrar os 12 objetos de `images/salas/` para o Supabase | Descartado | Zero referências no banco; copiá-los transporta lixo. São preservados no arquivo morto do S3 (Fase 5) |
| Copiar os 2 marcadores de pasta (`email/`, `images/espacos/`) | Descartado | Artefato do console da AWS, não são conteúdo. Os 3 objetos de 0 byte já saem junto com `images/salas/` |
| Converter as imagens para outro formato ou redimensionar | Descartado | A migração é cópia byte a byte; transformação inviabiliza a verificação por hash (CA-4) |
| Transform/resize de imagem do Supabase | Descartado | Recurso pago e sem demanda atual |

## 5. Requisitos

### Funcionais

- **RF-1**: Um `SupabaseStorageAdapter` implementa `IStorageAdapter` sem alterar nenhuma assinatura da interface.
- **RF-2**: `uploadFile(path, buffer, contentType)` grava no bucket configurado, na chave exatamente igual a `path`, sobrescrevendo se já existir (`upsert: true`), preservando o `contentType` recebido.
- **RF-3**: `deleteFile(path)` remove o objeto da chave `path` e é idempotente: apagar chave inexistente não lança.
- **RF-4**: `getPublicUrl(path)` devolve a URL pública do objeto, com exatamente uma barra entre a base e a chave — corrigindo o defeito de concatenação descrito em §2.
- **RF-5**: `deleteFiles(prefix)` remove todos os objetos sob o prefixo, percorrendo subpastas, com paginação.
- **RF-6**: A escolha do adapter em tempo de execução é feita por `STORAGE_DRIVER`, com os valores `s3` e `supabase`.
- **RF-7**: Os componentes de e-mail passam a montar a URL dos ícones a partir de `ASSETS_BASE_URL`, não mais de `PUBLIC_BUCKET`.

### Não funcionais

- **RNF-1**: O boot da API falha com mensagem explícita quando `STORAGE_DRIVER=supabase` e faltar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_STORAGE_BUCKET`, mantendo o comportamento de validação de [env.ts](../../../src/infra/env.ts).
- **RNF-2**: A `SUPABASE_SERVICE_ROLE_KEY` nunca é enviada ao cliente, não aparece em log, em resposta de erro nem no Swagger.
- **RNF-3**: Latência de upload no p95 não piora mais que 300 ms frente ao S3, medida sobre os logs do endpoint durante a Fase 4.
- **RNF-4**: Rollback do cutover é uma troca de variável de ambiente e restart, sem deploy de código e sem migration reversa, durante toda a Fase 4.

### Regras e invariantes

- **RB-1**: A chave do objeto é idêntica nos dois storages. `images/espacos/qrcode/qrcode-espaco-bbz-<id>.png` no S3 é `images/espacos/qrcode/qrcode-espaco-bbz-<id>.png` no Supabase. Nenhum código pode presumir prefixo de bucket dentro da chave.
- **RB-2**: O prefixo `images/` continua sendo imposto pelo back-end, não pelo cliente. O `folder` recebido é normalizado antes de compor a chave: segmentos `..` e `.`, barras iniciais e barras duplicadas são rejeitados com `400`.
- **RB-3**: O `imagePath` do endpoint de delete é rejeitado com `400` quando não começa com `images/`. Isso não resolve a falta de autorização por dono (§4), mas impede que um usuário autenticado apague estático ou objeto fora da árvore de imagens.
- **RB-4**: Nenhuma operação desta task escreve em tabela do banco.

## 6. Experiência e fluxos

Não há superfície visível nova. Os três fluxos existentes permanecem idênticos do ponto de vista do usuário:

1. **Cadastrar imagem de espaço** — admin envia arquivo, back-end grava e devolve o caminho relativo, front renderiza a partir de `NEXT_PUBLIC_BUCKET` + caminho. Muda apenas o host que serve o byte.
2. **Gerar QR code de espaço** — na primeira chamada o back-end gera o PNG, grava e persiste o caminho relativo em `spaces.qrcode_url`; nas seguintes devolve o valor persistido sem tocar no storage ([space-qrcode-use-case.ts:47-53](../../../src/models/space/space-qrcode-use-case.ts#L47-L53)). QR codes já impressos apontam para a URL do front, não para o storage, e não são afetados.
3. **Receber e-mail transacional** — o cliente de e-mail baixa os ícones de uma URL absoluta. Muda o host de S3 para o do front.

## 7. Design técnico

### Arquitetura e responsabilidades

Três camadas mudam, em ordem de dependência:

```
src/lib/supabase/index.ts          (novo)    cliente Supabase, espelha lib/aws/s3/index.ts
  └─ src/repositories/supabase/
       supabase-storage-repository.ts (novo) SupabaseStorageAdapter implements IStorageAdapter
  └─ src/repositories/storage-factory.ts (novo) escolhe o adapter por STORAGE_DRIVER
       └─ createDependencies() dos 3 controllers passa a chamar a factory
```

`src/repositories/base/storage-repository.ts` **não muda**. `src/repositories/s3/s3-storage-repository.ts` **não muda** — permanece intacto até a Fase 5, que o remove. É isso que torna o rollback uma troca de env.

A pasta `supabase/` ao lado de `s3/` e `pg/` segue a convenção do diretório, que já organiza repositórios por tecnologia.

### Fluxo de dados e contratos

A `IStorageAdapter` é integralmente satisfeita pelo SDK do Supabase, sem adaptação de assinatura:

| Método da interface | Chamada Supabase | Observação |
| --- | --- | --- |
| `uploadFile(path, buffer, contentType)` | `.from(bucket).upload(path, buffer, { contentType, upsert: true })` | `upsert` reproduz o `PutObjectCommand`, que sobrescreve por padrão |
| `deleteFile(path)` | `.from(bucket).remove([path])` | Não erra em chave inexistente, igual ao `DeleteObjectCommand` |
| `deleteFiles(prefix)` | `.from(bucket).list(prefix, { limit, offset })` + `.remove(keys)` | **Semântica diferente**, ver abaixo |
| `getPublicUrl(path)` | `.from(bucket).getPublicUrl(path).data.publicUrl` | Corrige a concatenação quebrada de hoje |

**A diferença que exige atenção:** `ListObjectsV2Command` com `Prefix` é recursivo e devolve chave completa; `.list()` do Supabase lista **uma pasta por vez** e devolve nome de arquivo, marcando subpasta com `id: null`. Reproduzir `deleteFiles` fiel ao contrato exige caminhar a árvore. Como o método é código morto (§2), a implementação correta é barata e evita entregar uma regressão silenciosa: quem chamar no futuro recebe o comportamento documentado.

Erros do Supabase chegam como `{ data, error }`, não como exceção. Toda chamada testa `error` e converte para `InternalServerError`, preservando o formato de erro de [s3-storage-repository.ts](../../../src/repositories/s3/s3-storage-repository.ts) — mesma `message`, mesma `action`, mesmo `console.error` com prefixo `💥`. Os contratos HTTP dos três endpoints não mudam: mesmos status, mesmos schemas de resposta, mesmo Swagger.

### Configuração de ambiente

`src/infra/env.ts` ganha, todas validadas por Zod no boot:

| Variável | Tipo | Fase | Papel |
| --- | --- | --- | --- |
| `STORAGE_DRIVER` | `z.enum(['s3','supabase']).default('s3')` | 2 | Seleciona o adapter. Vira `.default('supabase')` na Fase 5 e some depois |
| `SUPABASE_URL` | `z.string().url()` | 2 | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `z.string()` | 2 | Grava e apaga ignorando RLS. Secret File no Render |
| `SUPABASE_STORAGE_BUCKET` | `z.string().default('reservas-assets')` | 2 | Nome do bucket |
| `ASSETS_BASE_URL` | `z.string().url()` | 3 | Base dos estáticos servida pelo front. **Sem barra final** |
| `PUBLIC_BUCKET` | passa a `.optional()` na Fase 5 | 5 | Sai quando o driver `s3` for removido |
| `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | passam a `.optional()` na Fase 5 | 5 | Idem |

A validação condicional de RNF-1 usa `superRefine` sobre o schema: quando `STORAGE_DRIVER === 'supabase'`, as três variáveis de Supabase tornam-se obrigatórias.

No front, `NEXT_PUBLIC_BUCKET` muda de valor, não de nome:

```
antes:  https://gestao-bbz-app-assets.s3.us-east-1.amazonaws.com
depois: https://<ref>.supabase.co/storage/v1/object/public/reservas-assets
```

**Isto quebra [next.config.mjs:15](../../../../reservas-bbz-frontend/next.config.mjs#L15)**, que deriva o `hostname` do `remotePatterns` com `NEXT_PUBLIC_BUCKET.replace('https://','')`. Com um valor que agora contém caminho, o hostname sairia como `<ref>.supabase.co/storage/v1/object/public/reservas-assets` e o `next/image` recusaria toda imagem. A correção é derivar o host de verdade:

```js
const bucketUrl = new URL(process.env.NEXT_PUBLIC_BUCKET)
// remotePatterns: [{ protocol: 'https', hostname: bucketUrl.hostname, pathname: `${bucketUrl.pathname}/**` }]
```

### Dados e migração

**Nenhuma mudança de modelo persistente.** Não há tabela, coluna, índice, constraint ou migration nesta task, e por isso **não há DBML companheiro** — a spec não altera o estado-alvo do banco.

O que se move é objeto de storage, e a chave é preservada (RB-1). Estado atual e estado-alvo do conteúdo de `spaces`:

| Campo | Exemplo hoje | Exemplo depois | Muda? |
| --- | --- | --- | --- |
| `spaces.qrcode_url` | `images/espacos/qrcode/qrcode-espaco-bbz-003bbf76-...png` | idêntico | Não |
| `spaces.imagens[n]` | `images/espacos/espaco-bbz-20250630T133042683Z.webp` | idêntico | Não |

Medido em `gestao_reservas_copy` em 2026-09-17: 131 espaços, 131 com `qrcode_url` preenchido, 29 referências de imagem no total, **zero** valores absolutos (`like 'http%'`).

O provisionamento do bucket é registrado como migration Supabase `create_reservas_assets_storage_bucket`, já aplicada em `gestao_reservas_copy`: bucket `reservas-assets`, `public = true`, limite de 5 MB (o maior objeto atual tem 112 KB), MIME restrito a `image/webp`, `image/png`, `image/jpeg`. Uma policy `reservas_assets_public_read` concede `select` a `anon` e `authenticated`. **Nenhuma policy de `insert`, `update` ou `delete` é criada de propósito**: a escrita é exclusiva do back-end via `service_role`, que ignora RLS.

O procedimento operacional de cópia dos objetos está em `Desktop/manual-migracao-s3-supabase.md`, fora deste repositório, e não é executado pelo código da aplicação.

### Segurança e privacidade

O bucket é público para leitura, igual ao S3 de hoje — a exposição não aumenta. Imagem de sala e QR code não são dado sensível, e o QR code aponta para uma rota do front que já exige autenticação.

A `service_role` key é uma credencial de administrador do projeto Supabase: ela ignora RLS em **todas** as tabelas, não só em storage. Isso é mais poder do que a chave S3 atual concentrava. Mitigação: entra apenas como Secret File no Render (`/etc/secrets/.env.prod`, padrão já usado por [env.ts:10](../../../src/infra/env.ts#L10)), nunca no repositório, e o adapter é o único módulo que instancia o cliente.

#### Matriz de permissões

| Ação/recurso | Perfil | Escopo permitido | Enforcement |
| --- | --- | --- | --- |
| Ler objeto de `reservas-assets` | Qualquer um, sem login | Todo o bucket | Bucket público + policy `reservas_assets_public_read` |
| Gravar objeto | Back-end | Chaves sob `images/` | `service_role` no servidor + RB-2 no use case |
| Gravar objeto | `anon`, `authenticated` | Nenhum | Ausência de policy de `insert` |
| Apagar objeto | Back-end | Chaves sob `images/` | `service_role` + RB-3 no use case |
| Apagar objeto | `anon`, `authenticated` | Nenhum | Ausência de policy de `delete` |
| Chamar `/image/s3/upload` e `/image/s3/delete` | Usuário logado com conta válida | Qualquer chave sob `images/` | `verifyJWT` + `validateUserAccount`, já existentes |

A última linha registra o defeito pré-existente: qualquer usuário autenticado pode apagar qualquer imagem, de qualquer espaço. RB-3 reduz o alcance para dentro de `images/`; a autorização por dono fica fora de escopo (§4).

### Observabilidade

Mantido o padrão de `console.error` com prefixo `💥` já usado nos dois adapters. Acrescentar ao log de erro o driver ativo e a chave, para que uma falha durante a Fase 4 diga de imediato qual storage respondeu. Um log único no boot registra `STORAGE_DRIVER` e o bucket em uso — é o sinal que confirma o cutover e o rollback sem inspecionar o ambiente.

## 8. Falhas e edge cases

| Condição | Comportamento esperado | Recuperação/observação |
| --- | --- | --- |
| Objeto não copiado do S3 e já lido pelo front após o cutover | `404` no `next/image`, card sem imagem | Detectado pela verificação de contagem e hash da Fase 3 antes do cutover. Rollback por env (RNF-4) |
| Upload excede 5 MB | Supabase devolve erro; adapter converte em `BadRequestError` | Limite novo, não existia no S3. O maior objeto atual tem 112 KB |
| Upload com MIME fora da lista permitida | Supabase recusa; adapter converte em `BadRequestError` | O use case sempre envia `image/webp`; o QR code envia `image/png`. Ambos permitidos |
| `deleteFile` em chave inexistente | Resolve sem erro | Idempotência de RF-3, igual ao S3 hoje |
| `folder` com `..` ou barra inicial | `400` antes de tocar no storage | RB-2. Hoje o caminho é montado sem validação |
| `imagePath` de delete fora de `images/` | `400` | RB-3 |
| `SUPABASE_SERVICE_ROLE_KEY` ausente com driver `supabase` | Boot falha com erro explícito | RNF-1. Falha no boot é preferível a falhar no primeiro upload |
| Front lê imagem enquanto o back já grava no Supabase | Imagem nova some para o usuário | Evitado pela ordem da Fase 4: front aponta para o Supabase **antes** do back-end passar a gravar nele |
| QR code de espaço novo criado durante a janela de cópia | Gerado no S3, ausente no Supabase | A cópia incremental da Fase 4 (`sync` final) captura. Reversível: basta apagar `qrcode_url` do espaço para regerar |
| `og-800x600-bbz.png` e `og-800x600-reserva.png` | Continuam `404` | Defeito pré-existente, fora de escopo (§4) |

## 9. Estratégia de testes

**O repositório não tem harness de teste automatizado.** Não existe `test` em `scripts` do `package.json`, não há vitest/jest/playwright em `devDependencies` e não há diretório `tests/`, `e2e/` ou arquivo `*.test.ts`. Introduzir um harness completo é escopo maior que esta migração, então a verificação é por script de conferência e roteiro manual — declarado aqui em vez de omitido.

| Camada | Cenário | Arquivo | Evidência esperada |
| --- | --- | --- | --- |
| Script (Node) | Contagem e hash MD5 de cada chave batem entre S3 e Supabase | `scripts/verify-storage-migration.mjs` (novo, ver manual) | Saída `190/190 OK, 0 divergências` |
| SQL | Nenhuma linha de `spaces` alterada pela migração | consulta de `count`/`max(updated_at)` antes e depois | Mesmo resultado nas duas execuções |
| SQL | Toda chave referenciada no banco existe no bucket novo | `anti join` entre refs de `spaces` e `storage.objects` | Zero linhas |
| Manual | Upload de imagem de espaço pelo admin com driver `supabase` | Roteiro §10 CA-1 | Objeto aparece em `storage.objects`; imagem renderiza |
| Manual | Geração de QR code de espaço sem `qrcode_url` | Roteiro §10 CA-2 | PNG gravado; `qrcode_url` com caminho relativo |
| Manual | Exclusão de imagem | Roteiro §10 CA-3 | Objeto some do bucket; endpoint devolve `200` |
| Manual | E-mail transacional com ícones | Roteiro §10 CA-6 | Os 6 ícones renderizam no cliente de e-mail |
| Manual | Rollback por variável de ambiente | Roteiro §10 CA-7 | `STORAGE_DRIVER=s3` + restart volta a gravar no S3 |

Sem superfície visível nova, não há marcadores `data-testid` a declarar.

## 10. Critérios de aceite

- **CA-1** — Dado `STORAGE_DRIVER=supabase`, quando um admin envia imagem em `POST /v1/private/image/s3/upload?folder=espacos&group=espaco`, então a resposta é `201` com `imagePath` no formato `images/espacos/espaco-<timestamp>.webp`, o objeto existe em `storage.objects` com essa chave exata, e nada foi gravado no S3.
- **CA-2** — Dado um espaço sem `qrcode_url`, quando o endpoint de QR code é chamado, então o PNG é gravado em `images/espacos/qrcode/qrcode-espaco-bbz-<spaceId>.png` no Supabase e `spaces.qrcode_url` recebe **o caminho relativo**, não URL absoluta.
- **CA-3** — Dado um objeto existente, quando `DELETE /v1/private/image/s3/delete` recebe seu `imagePath`, então a resposta é `200` e o objeto não existe mais no bucket.
- **CA-4** — Dado o inventário do S3, quando a cópia termina, então as 190 chaves dinâmicas existem no Supabase com MD5 idêntico, e os 12 objetos de `images/salas/` (3 deles vazios) e os 2 marcadores de pasta **não** foram copiados.
- **CA-5** — Dada a migração concluída, quando se compara `spaces` antes e depois, então `count(*)`, `count(qrcode_url)`, a soma de `jsonb_array_length(imagens)` e o `max(updated_at)` são idênticos.
- **CA-6** — Dado um e-mail transacional disparado após a Fase 3, quando aberto em Gmail e Outlook, então o logo do cabeçalho e os 5 ícones do rodapé renderizam, servidos por `ASSETS_BASE_URL`.
- **CA-7** — Dado o driver `supabase` ativo, quando `STORAGE_DRIVER` volta para `s3` e a API reinicia, então um upload novo grava no S3 e o boot loga o driver ativo — sem deploy de código e sem tocar no banco.
- **CA-8** — Dado `folder=../../etc`, quando o upload é chamado, então a resposta é `400` e nada é gravado (RB-2).
- **CA-9** — Dado `imagePath=404-error.svg`, quando o delete é chamado, então a resposta é `400` e o objeto permanece (RB-3).
- **CA-10** — Dado o front com `NEXT_PUBLIC_BUCKET` apontando para o Supabase, quando a listagem de espaços é aberta, então as imagens renderizam pelo `next/image` sem erro de host não configurado (correção do `remotePatterns`).

## 11. Rollout e rollback

**Fase 1 — Destravar a troca (sem mudança de comportamento).**
Trocar o tipo de `Dependencies.storageRepository` para `IStorageAdapter` em [image-use-case.ts:39](../../../src/models/image/image-use-case.ts#L39) e [space-qrcode-use-case.ts:22](../../../src/models/space/space-qrcode-use-case.ts#L22), ajustando os imports. Os três controllers continuam instanciando `S3StorageAdapter`. Nada mais muda.
*Skills: `apply-clean-code`.* *Validação: `npm run lint:eslint:check`, `npm run build`. Comportamento idêntico em produção — é refatoração de tipo.*

**Fase 2 — Adapter novo, desligado.**
Instalar `@supabase/supabase-js`. Criar `src/lib/supabase/index.ts`, `src/repositories/supabase/supabase-storage-repository.ts` e `src/repositories/storage-factory.ts`. Adicionar as variáveis de ambiente com `STORAGE_DRIVER` default `s3`. Aplicar RB-2 e RB-3 nos use cases. Deploy com o driver ainda em `s3`.
*Skills: `apply-clean-code`.* *Validação: CA-8, CA-9, `npm run lint:eslint:check`, `npm run build`. Produção segue no S3; o código novo está presente e inerte.*

**Fase 3 — Estáticos e cópia dos dinâmicos.**
Mover os 7 arquivos de `email/` e os 2 da raiz para `reservas-bbz-frontend/public/`, commitar e publicar o front. Trocar as 6 referências de `PUBLIC_BUCKET` para `ASSETS_BASE_URL` nos componentes de e-mail e publicar o back-end. Copiar os 190 objetos dinâmicos para o Supabase e rodar o verificador. O S3 continua servindo tudo; a cópia é aditiva.
*Validação: CA-4, CA-6. Ponto de pausa: qualquer divergência no verificador interrompe o rollout aqui, sem impacto, porque nada apontou para o Supabase ainda.*

**Fase 4 — Cutover.**
Nesta ordem: (a) `sync` incremental final para capturar o que entrou desde a Fase 3; (b) apontar `NEXT_PUBLIC_BUCKET` do front para o Supabase, com a correção do `remotePatterns`, e publicar — leitura passa para o Supabase; (c) confirmar que as imagens carregam; (d) `STORAGE_DRIVER=supabase` no back-end e restart — escrita passa para o Supabase. A ordem importa: leitura antes da escrita evita a janela em que o back grava onde o front não lê.
*Skills: `bbz-frontend-hightech` (passo b).* *Validação: CA-1, CA-2, CA-3, CA-5, CA-10.*
**Rollback:** `STORAGE_DRIVER=s3` e `NEXT_PUBLIC_BUCKET` de volta ao S3, com restart. Sem deploy, sem migration. Objetos gravados no Supabase durante a janela precisam ser copiados de volta — daí a janela de observação curta.

**Fase 5 — Limpeza, após 7 dias sem tráfego de leitura no S3 (OBJ-3).**
Provisionar o bucket no projeto Supabase de produção usando a mesma migration. Remover `src/repositories/s3/`, `src/lib/aws/`, `@aws-sdk/client-s3`, `STORAGE_DRIVER` e as quatro variáveis de S3. Passar o bucket S3 para Glacier por 90 dias antes de excluir — ele ainda guarda os 12 órfãos de `images/salas/`, não migrados.
*Skills: `apply-clean-code`.* *Validação: `npm run lint:eslint:check`, `npm run build`, CA-1 a CA-3 repetidos.*

## 12. Riscos e trade-offs

| Risco/decisão | Impacto | Mitigação ou trade-off |
| --- | --- | --- |
| Bucket provisionado em `gestao_reservas_copy`, não no projeto de produção | O ambiente validado não é o de destino final | Deliberado: valida a migração sem risco. A mesma migration roda em produção na Fase 5. **Hipótese H-1 depende disso** |
| `service_role` key concentra poder sobre todo o projeto, não só storage | Vazamento expõe o banco inteiro | Secret File no Render, instanciação em módulo único, ausente do repositório. Trade-off aceito: a alternativa (chave S3-compatível, restrita a storage) custaria manter o `@aws-sdk` |
| Limite de 5 MB e MIME restrito não existiam no S3 | Upload que passava pode ser recusado | Maior objeto atual: 112 KB. O código só envia `image/webp` e `image/png` |
| `deleteFiles` implementado com semântica recursiva que hoje ninguém exercita | Bug latente só apareceria no primeiro uso | Implementar fiel ao contrato custa pouco agora. Alternativa considerada e descartada: remover o método da interface, o que mudaria o contrato no meio de uma migração |
| Cópia manual dos objetos, fora de CI | Erro humano ou cópia parcial | Verificador por hash (CA-4) roda antes do cutover, e a Fase 3 é inteiramente reversível |
| Migração do front e do back em repositórios separados | Dessincronização na janela de cutover | Ordem explícita na Fase 4: leitura antes da escrita |

## 13. Decisões e alternativas

| Decisão | Evidência/justificativa | Alternativa descartada |
| --- | --- | --- |
| Um bucket público com as chaves idênticas | 131 linhas de `spaces` guardam caminho relativo e nenhuma URL absoluta. Preservar a chave reduz a migração a uma troca de env e elimina UPDATE em produção | Buckets por domínio (`espacos`, `qrcodes`) sem o prefixo `images/`: mais limpo, mas exigiria UPDATE em 131 linhas, janela de inconsistência e migration reversa |
| Adapter nativo com `@supabase/supabase-js` | Alinha com o restante do stack BBZ, remove o `@aws-sdk` e abre caminho para signed URL e RLS sem nova dependência | **Alternativa mínima registrada:** o Supabase expõe endpoint S3-compatível em `https://<ref>.storage.supabase.co/storage/v1/s3` com `forcePathStyle: true`, utilizável pelo `@aws-sdk/client-s3` que já está instalado. Custaria quase nenhuma linha de código, mas manteria a dependência da AWS e o vocabulário de bucket dentro do adapter. **Descartada para a aplicação, mas usada na ferramenta de migração**, onde é justamente o que permite copiar S3 → Supabase com `rclone`/`aws s3 sync` |
| Seleção por `STORAGE_DRIVER` em vez de troca direta | Torna o rollback uma variável de ambiente (RNF-4) em vez de um deploy de revert | Substituir `S3StorageAdapter` por `SupabaseStorageAdapter` direto nos controllers: menos código, mas rollback vira deploy sob pressão |
| Estáticos no `public/` do front | 9 arquivos de nome fixo, ~173 KB, que nunca mudam. No git ficam versionados, sem custo de storage e sem depender de credencial | Mantê-los em storage: menor mudança de código, mas continua pagando por arquivo imutável que já poderia estar no repositório |
| `images/salas/` não migra | Zero referências em `spaces`; 3 dos 12 têm 0 byte; 9 são duplicatas de `images/espacos/` | Migrar tudo por precaução: transportaria lixo comprovado para o storage novo |
| Interface `IStorageAdapter` mantida sem alteração | Os 4 métodos mapeiam 1:1 para o SDK do Supabase. Mudar assinatura seria custo sem retorno | Redesenhar a interface junto com a migração: acopla duas mudanças e dificulta isolar a causa de qualquer regressão |
| Sem DBML | A task não cria nem altera modelo persistente (RB-4) | — |

## 14. Questões em aberto

| Questão | Impacto | Responsável/fonte | Bloqueante? |
| --- | --- | --- | --- |
| O projeto de produção (`wnzvnmqvlmmwawnjuszo`) está na mesma organização Supabase que os projetos visíveis pelo MCP? | Define se a Fase 5 usa o mesmo fluxo de migration ou exige acesso separado | Console do Supabase | Não — só bloqueia a Fase 5 |
| O bucket S3 é usado por algum sistema BBZ fora deste par de repositórios? | Desligá-lo poderia quebrar terceiro | Buscar `gestao-bbz-app-assets` nos demais repositórios antes da Fase 5 | Não — bloqueia apenas a exclusão do bucket |

### Hipóteses

| Hipótese | Impacto se errada | Responsável/fonte de validação | Contingência | Bloqueante? |
| --- | --- | --- | --- | --- |
| **H-1**: `gestao_reservas_copy` reflete fielmente o schema e o volume de produção | Contagens de §2 e CA-5 estariam erradas | Rodar as mesmas consultas contra prod antes da Fase 4 | Refazer o inventário contra produção; nenhum passo destrutivo depende dele | Não |
| **H-2**: `app-sistema-reserva.bbz.com.br` serve `public/` sem autenticação, alcançável por cliente de e-mail | Ícones de e-mail quebram para o destinatário | `curl -I https://app-sistema-reserva.bbz.com.br/email/logo-horizontal-primary.png` logo após a Fase 3 | Criar `assets/` no bucket Supabase e apontar `ASSETS_BASE_URL` para lá; o desenho já isola isso numa variável | Não |
| **H-3**: Nenhum consumidor externo lê o bucket S3 direto | Cutover quebraria integração desconhecida | Métricas de leitura do S3 durante os 7 dias da Fase 5 | Manter o bucket vivo além da janela | Não |

## 15. Definition of Ready

Implementation Ready: **SIM**

Bloqueios:
- Nenhum.

Hipóteses aceitas:
- **H-1**, **H-2** e **H-3** permanecem abertas e não bloqueiam. Nenhuma delas condiciona as Fases 1 e 2, que não alteram comportamento em produção. H-1 é verificada antes da Fase 4 por consulta read-only; H-2 é verificada por `curl` logo após a Fase 3, quando o S3 ainda serve tudo; H-3 é verificada por métrica durante a janela de observação da Fase 5. As três têm contingência registrada e nenhuma exige decisão antes do início da implementação.
