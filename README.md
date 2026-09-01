# BBZ App Backend

API do sistema interno de reserva de espaços da BBZ. O serviço concentra autenticação, usuários, equipes, espaços, reservas, compliance, presença, notificações e integrações externas.

## Infraestrutura

| Componente      | Desenvolvimento                                       | Produção                                                   |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| API             | `http://localhost:3334`                               | `https://backend.bbz.com.br` (Render)                      |
| Swagger UI      | `http://localhost:3334/docs`                          | `https://backend.bbz.com.br/docs`                          |
| Health check    | `http://localhost:3334/v1/public/infra/server/health` | `https://backend.bbz.com.br/v1/public/infra/server/health` |
| PostgreSQL      | Docker, PostgreSQL 16 em `localhost:25432`            | Supabase                                                   |
| Frontend        | `http://localhost:3001`                               | `https://app.bbz.com.br` (Vercel)                          |
| E-mail          | Ethereal                                              | Brevo SMTP Relay                                           |
| Objetos/imagens | AWS S3                                                | AWS S3                                                     |
| OAuth           | Google OAuth 2.0                                      | Google OAuth 2.0                                           |
| Fechaduras      | TTLock/DLOCK API                                      | TTLock/DLOCK API                                           |

O Swagger é aberto em desenvolvimento e protegido por Basic Auth em produção. As credenciais são definidas por `API_DOC_USER` e `API_DOC_PASSWORD`.

## Stack e arquitetura

- Node.js 22, TypeScript, Fastify 5 e Zod.
- PostgreSQL acessado com `pg` e SQL explícito, sem ORM.
- Migrações com `node-pg-migrate`.
- JWT de sessão e refresh token em cookies, proteção CSRF e RBAC.
- Nodemailer, React Email e Tailwind para mensagens transacionais.
- `toad-scheduler` para tarefas recorrentes no mesmo processo da API.
- `tsup` para build CommonJS em `build/`.

```text
src/
├── api/v1/        controllers públicos e privados
├── models/        casos de uso e regras de negócio
├── repositories/ contratos e implementações PostgreSQL/S3
├── schemas/       contratos Zod de entrada e saída
├── middlewares/   autenticação, autorização e erros
├── routes/        composição dos módulos HTTP
├── infra/         banco, env, e-mail, jobs, migrações e scripts
├── lib/           integrações e bibliotecas internas
└── utils/         datas, e-mail, senhas e utilitários gerais
```

Os módulos HTTP atuais são `infra`, `auth`, `user`, `image`, `space`, `space-slot`, `reservation`, `team`, `occurrence`, `outpost` e `catraca`. O contrato detalhado de cada endpoint pertence ao Swagger.

## Ambientes

O contrato completo está em `.env.example`. Arquivos com valores reais não devem ser versionados.

- `.env`: desenvolvimento local. Também é consumido pelo Docker Compose e por `migration:up`.
- `.env.prod`: produção. No Render, deve ser cadastrado como Secret File em `/etc/secrets/.env.prod`.
- `.env.example`: referência versionada, sem credenciais.

`src/infra/env.ts` valida as variáveis na inicialização. Em produção, `PORT` fornecida pelo Render prevalece quando `API_PORT` não estiver definida. Os grupos de configuração são hosts, autenticação, PostgreSQL, SMTP, S3, Google OAuth, links institucionais e DLOCK.

## Operação local

Requisitos: Node.js 22, npm e Docker com Compose.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` gera o CSS dos e-mails, inicia o PostgreSQL, aguarda o banco, aplica migrações, executa o seed idempotente e inicia o Fastify em watch mode. O seed cria somente as contas técnicas `dev@bbz.com.br` e `admin@bbz.com.br`; a senha deve ser tratada como dado operacional e alterada conforme o ambiente.

O frontend deve ser iniciado depois que a API e o Swagger local estiverem disponíveis, pois o Orval consulta `http://localhost:3334/docs/json`.

## Scripts

| Script                               | Finalidade                                                |
| ------------------------------------ | --------------------------------------------------------- |
| `npm run dev`                        | Bootstrap completo do ambiente local e API em watch mode. |
| `npm run build`                      | Compila e minifica `src/` em `build/`.                    |
| `npm start`                          | Executa `build/server.js` com `NODE_ENV=production`.      |
| `npm run services:up`                | Inicia o PostgreSQL local.                                |
| `npm run services:logs`              | Acompanha os logs do PostgreSQL.                          |
| `npm run services:stop`              | Para o container sem remover dados.                       |
| `npm run services:down`              | Remove o container; o volume nomeado é preservado.        |
| `npm run migration:create -- <nome>` | Cria uma migração em `src/infra/migrations`.              |
| `npm run migration:up`               | Aplica migrações usando `.env`.                           |
| `npm run migrate:up`                 | Aplica migrações de produção usando o Secret File.        |
| `npm run seed`                       | Garante usuários e contas técnicas no banco configurado.  |
| `npm run wait-for-postgres`          | Aguarda o container local aceitar conexões.               |
| `npm run tailwind:generate`          | Regenera o CSS usado pelos templates de e-mail.           |
| `npm run tailwind:generate:watch`    | Regenera o CSS de e-mail continuamente.                   |
| `npm run lint:prettier:check`        | Verifica formatação.                                      |
| `npm run lint:eslint:check`          | Executa análise estática.                                 |

## Produção

O backend é publicado no Render com build `npm install && npm run build`, pre-deploy `npm run migrate:up` e start `npm start`. O pre-deploy lê `/etc/secrets/.env.prod` e aplica as migrações no Supabase antes de ativar a nova versão. Não execute `seed` nem comandos de migração contra produção sem revisão explícita do alvo.

O domínio `backend.bbz.com.br` deve apontar para o serviço Render. CORS aceita o site institucional, o frontend administrativo e o host técnico configurado. Cookies usam o domínio `.bbz.com.br`, permitindo autenticação entre `app.bbz.com.br` e `backend.bbz.com.br`.

Os jobs vivem no processo da API. Portanto, o serviço Render precisa permanecer ativo e com uma única instância de scheduler, ou os jobs serão interrompidos/duplicados. Alterações no callback do Google exigem atualização correspondente no Google Cloud Console.

## Regras de negócio

### Usuários e equipe

- As roles de sistema são `admin`, `dev` e `user`; cargos organizacionais são independentes da role.
- A hierarquia é `director > supervisor > manager > assistant_manager > assistant`.
- Um usuário possui no máximo um cargo; somente contas ativas podem ser nomeadas e usuários `dev` não recebem cargo.
- Existe no máximo um diretor. Autorizações de gestão respeitam role, nível hierárquico e vínculo de equipe.
- Afastamentos ativos impedem reserva de workstation e retiram o usuário do compliance; reservas de salas continuam permitidas.
- Postos avançados isentam compliance, prazo e limite semanal, mas mantêm a regra de uma workstation por dia.

### Espaços e reservas

- `room`: permite colaboradores BBZ, convidados externos e solicitação de copeira; não possui limite semanal por cargo.
- `workstation`: uso individual, sem convidados ou copeira, com regras semanais por cargo.
- Somente espaços ativos e slots válidos podem ser reservados. Slots sequenciais são consolidados em uma reserva.
- A pré-reserva retém os slots por 5 minutos; consultas de disponibilidade ignoram retenções expiradas.
- Salas podem ser programadas em até 90 dias e toleram criação até 30 minutos depois do início do slot.
- Workstations são planejadas para a próxima semana, considerando semana de domingo a sábado. O agendamento regular ocorre de segunda a quinta; sexta é bloqueada.
- Limite semanal de workstation: gerente 2 dias, subgerente 3 e assistente 3. Ao completar o limite, pelo menos um dia deve ser segunda ou sexta.
- É permitida somente uma reserva de workstation por usuário por dia.
- Exceção temporária concedida por admin/dev, diretor ou supervisor da equipe libera prazo e limites para a semana vigente; a regra de uma workstation por dia permanece.
- Fechamento/cancelamento exige reserva ativa e autorização. Workstation só pode ser fechada com pelo menos 24 horas de antecedência; ação após a quinta-feira da semana anterior gera notificação de compliance ao supervisor.

### Check-in, presença e ocorrências

- Proprietário e convidados associados podem fazer check-in/out uma vez por reserva.
- Check-in abre 15 minutos antes. O limite posterior é 1 hora para sala e 4 horas para workstation.
- Check-out exige check-in anterior e ocorre no mesmo dia.
- Jornada de workstation inferior a 8h45 cria ocorrência de checkout antecipado pendente.
- Admin/dev e diretor tratam qualquer ocorrência; supervisor trata apenas ocorrências de sua equipe.
- Ausência ou check-in sem checkout gera advertência. Ao atingir 5 advertências, a conta é desativada e requer reativação administrativa.

### Compliance semanal

- Gerente deve reservar 2 dias de workstation; subgerente e assistente, 3 dias. Diretor e supervisor são isentos.
- Ao completar a obrigação, a semana precisa incluir segunda ou sexta.
- O acompanhamento considera a semana de domingo a sábado e exclui usuários afastados ou em posto avançado.
- Usuário acompanha seu próprio estado; supervisores visualizam a equipe; diretor, admin e dev possuem visão consolidada.

## Jobs agendados

Todos os crons abaixo usam `America/Sao_Paulo` e bloqueiam sobreposição da própria execução.

| Agenda        | Job                                     | Responsabilidade                                                       |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| A cada 30 min | `cleanup-expired-pre-reservations`      | Remove slots com pré-reserva expirada.                                 |
| Diário 02:50  | `cleanup-expired-reservations`          | Remove slots reservados de datas passadas.                             |
| Diário 03:00  | `attendance-status-updater`             | Consolida presença do dia anterior, advertências e bloqueios.          |
| Diário 03:10  | `email-notification-data-collector`     | Envia até 60 notificações de ausência/checkout pendente, a 1 e-mail/s. |
| Quarta 02:00  | `weekly-compliance-wednesday-reminder`  | Lembra por BCC os usuários ainda não compliant para a próxima semana.  |
| Sexta 02:00   | `weekly-compliance-friday-report`       | Envia pendências a supervisores e relatório consolidado a diretores.   |
| Segunda 02:10 | `weekly-early-checkout-monday-reminder` | Envia a supervisores ocorrências pendentes de checkout antecipado.     |

## Segurança e manutenção

- Endpoints privados exigem JWT; métodos mutáveis também exigem `X-CSRF-Token` compatível com o token da sessão.
- Tokens, senhas e chaves pertencem exclusivamente aos provedores de secrets. Nunca devem aparecer no README, Swagger, logs ou commits.
- Migrações são append-only depois de aplicadas em produção.
- `src/swagger.json` é regenerado quando a API inicia em desenvolvimento.
- Não há suíte automatizada no repositório atualmente. Antes de entregar uma alteração, execute:

```bash
npm run lint:prettier:check
npm run lint:eslint:check
npx tsc --noEmit
npm run build
```
