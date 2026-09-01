// src/api/v1/private/reservation/create/space-reservation-create.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  createSpaceReservation,
  createSpaceReservationSchema,
} from '@/models/reservation/space-reservation-create-use-case'
import { PgOutpostsRepository } from '@/repositories/pg/pg-outposts-repository'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  spaceReservationCreateBodySchema,
  spaceReservationCreateResponseSchema,
} from '@/schemas/reservation/space-reservation-create-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  const spaceSlotRepository = new PgSpaceSlotRepository()
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const usersRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const outpostsRepository = new PgOutpostsRepository()

  return {
    spacesRepository,
    spaceSlotRepository,
    spaceReservationRepository,
    usersRepository,
    teamPositionsRepository,
    outpostsRepository,
  }
}

export async function spaceReservationCreateController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/reservation',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'createSpaceReservation',
        summary: 'Criar uma reserva de espaço',
        description: `Este endpoint permite que um usuário crie uma reserva de espaço a partir de slots pré-reservados.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Novo modelo de reservas**:
  - Cada reserva agora possui somente uma linha na tabela independente de quantos slots estejam associados a ela
  - Slots sequenciais (ex: de 08:00 até às 12:00) serão considerados uma única reserva
  - Todos os IDs dos slots são armazenados em um array JSONB na reserva

* **Funcionalidade**:
  1. Converte um conjunto de pré-reservas (slots) em uma única reserva confirmada
  2. Registra os detalhes adicionais da reserva (colaboradores, convidados externos, etc.)
  3. Associa o usuário atual à reserva
  4. Verifica automaticamente se cada slot existe e está pré-reservado pelo mesmo usuário
  5. Cada slot deve estar dentro do período de pré-reserva (5 minutos)

* **Regras de Negócio para Workstations**:

  **1. Limites Semanais por Cargo**:
  - Gerente: máximo de **2 dias por semana** (domingo a sábado)
  - Subgerente: máximo de **3 dias por semana** (domingo a sábado)
  - Assistente: máximo de **3 dias por semana** (domingo a sábado)
  - Outros cargos: **sem limite** de dias
  - Esta regra **NÃO se aplica a salas (rooms)**, apenas a workstations
  - **BYPASS**: Usuários em Posto Avançado são completamente isentos desta regra

  **2. Segunda ou Sexta-Feira Obrigatória**:
  - Quando Gerentes, Subgerentes ou Assistentes **completarem seu limite de dias**, devem incluir pelo menos **UMA segunda-feira OU sexta-feira**
  - Exemplo válido (Gerente): segunda + terça = 2 dias ✅
  - Exemplo inválido (Gerente): terça + quarta = 2 dias sem segunda/sexta ❌
  - Esta validação só ocorre quando o usuário atinge o limite máximo do cargo
  - Esta regra **NÃO se aplica a salas (rooms)**, apenas a workstations
  - **BYPASS**: Usuários em Posto Avançado são completamente isentos desta regra

  **3. Uma Reserva de Workstation por Dia**:
  - Não é permitido ter múltiplas reservas de workstation no mesmo dia
  - Caso já exista uma reserva de workstation em determinada data, novas reservas para o mesmo dia serão bloqueadas
  - Esta regra **NÃO se aplica a salas (rooms)**, apenas a workstations

* **Fluxo de reserva**:
  1. O usuário faz uma ou mais pré-reservas (via endpoint de pré-reserva)
  2. O sistema reserva os slots por 5 minutos para o usuário
  3. O usuário confirma a reserva com este endpoint, fornecendo detalhes adicionais
  4. O sistema confirma a reserva e atualiza o status dos slots para 'reserved'

* **Parâmetros no corpo**:
  - spaceId (obrigatório): Identificador UUID do espaço
  - spaceSlotIds (obrigatório): Lista de identificadores UUID dos slots pré-reservados
  - bbzCollaborators (opcional): Lista de colaboradores da BBZ que participarão da reunião
  - externalGuests (opcional): Lista de convidados externos que participarão da reunião
  - needsCopeira (opcional): Indica se a reserva necessita de serviço de copeira (padrão: false)

* **Exemplo de uso**:
  - Requisição básica: \`POST /v1/private/reservation\` com body:
  \`\`\`json
  {
    "spaceId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "spaceSlotIds": ["b2c3d4e5-f6a7-8901-bcde-2345678901cd", "c3d4e5f6-a789-0123-cdef-3456789012de"],
    "bbzCollaborators": ["João Silva", "Maria Oliveira"],
    "externalGuests": ["Carlos Santos - Empresa XYZ"],
    "needsCopeira": true
  }
  \`\`\`

* **Formato da resposta**:
  - reservations: Array de objetos com todas as informações das reservas criadas
  - message: Mensagem informativa de sucesso

* **Notas**:
  - O ID do usuário que faz a reserva é automaticamente capturado do token JWT
  - As reservas só podem ser criadas a partir de slots que já estejam pré-reservados pelo mesmo usuário
  - Cada pré-reserva deve estar dentro do período válido de 5 minutos
  - O status das reservas criadas será definido como 'reserved'
  - Mesmo que sejam fornecidos múltiplos slots, será criada apenas UMA reserva contendo todos esses slots
  - O slot_range armazenará o intervalo completo da reserva (hora inicial até hora final)`,
        body: spaceReservationCreateBodySchema,
        response: {
          201: spaceReservationCreateResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...createSpaceReservationSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      // Obter o ID do usuário autenticado do contexto da requisição
      const userId = request.requestContext.get('userId') as string
      // Obter a exceção de prazo do userAccount (setado pelo middleware validateUserAccount)
      const userAccount = request.requestContext.get('userAccount')
      const bookingExceptionUntil = userAccount?.bookingExceptionUntil ?? null

      // Inserir o userId e bookingExceptionUntil no body da requisição
      const body = {
        ...request.body,
        userId,
        bookingExceptionUntil,
      }

      // Invocar o caso de uso
      const result = await createSpaceReservation(
        {
          body,
        },
        deps,
      )

      return reply.status(201).send(result)
    },
  )
}
