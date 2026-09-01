// src/api/v1/private/space-slot/pre-reserve/create/space-slot-pre-reserve.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  createSpaceSlotPreReserve,
  createSpaceSlotPreReserveSchema,
} from '@/models/space-slot/space-slot-pre-reserve-use-case'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceSlotPreReserveBodySchema,
  spaceSlotPreReserveResponseSchema,
} from '@/schemas/space-slot/space-slot-pre-reserve-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  const spaceSlotRepository = new PgSpaceSlotRepository()

  return { spacesRepository, spaceSlotRepository }
}

export async function spaceSlotPreReserveController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/space-slot/pre-reserve',
    {
      schema: {
        tags: ['Space Slot'],
        operationId: 'createSpaceSlotPreReserve',
        summary: 'Criar pré-reserva de slot em um espaço',
        description: `Este endpoint permite que um usuário crie uma pré-reserva de um slot (horário) em um espaço específico.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Funcionalidade**:
  1. Cria uma pré-reserva para um slot (combinação de espaço e horário específico)
  2. Define o status como 'pre_reserved'
  3. Associa o usuário atual à pré-reserva
  4. Define um tempo limite de 5 minutos para confirmação da reserva
  5. Verifica automaticamente se o espaço existe e está ativo
  6. Impede pré-reservas de slots já reservados ou pré-reservados
  7. Impede pré-reservas para datas passadas

* **Fluxo de reserva**:
  1. O usuário faz uma pré-reserva (este endpoint)
  2. O sistema reserva o slot por 5 minutos para o usuário
  3. O usuário deve confirmar a reserva em até 5 minutos
  4. Caso contrário, o slot fica disponível novamente após o tempo limite

* **Parâmetros no corpo**:
  - spaceId (obrigatório): Identificador UUID do espaço
  - slotStart (obrigatório): Data e hora de início no formato ISO com timezone (ex: 2023-08-15T14:30:00-03:00)
  - slotEnd (obrigatório): Data e hora de término no formato ISO com timezone (ex: 2023-08-15T15:30:00-03:00)
  - status (opcional): Status da reserva, padrão 'pre_reserved'

* **Exemplo de uso**:
  - Requisição básica: \`POST /v1/private/space-slot/pre-reserve\` com body:
  \`\`\`json
  {
    "spaceId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "slotStart": "2023-08-15T14:30:00-03:00",
    "slotEnd": "2023-08-15T15:30:00-03:00"
  }
  \`\`\`

* **Formato da resposta**:
  - slot: Objeto com todas as informações do slot pré-reservado
  - message: Mensagem informativa de sucesso

* **Notas**:
  - As datas devem estar no formato ISO com informação de timezone
  - O slot reservado tem duração de 1 hora para salas de reunião ou 5 horas para workstations
  - Uma pré-reserva expira automaticamente após 5 minutos se não for confirmada
  - Um usuário não pode pré-reservar um slot já reservado ou pré-reservado
  - Não é possível pré-reservar slots para datas passadas
  - O ID do usuário que faz a pré-reserva é automaticamente capturado do token JWT

* **Regras específicas para Workstations**:
  - Workstations só podem ser reservadas até o sábado da próxima semana (considerando semana de domingo a sábado)
  - Reservas de workstations não podem ser feitas às sextas-feiras (bloqueio de dia da semana)
  - Duração do slot: 5 horas (das 8h às 13h, por exemplo)
  - Exemplo: Se hoje é segunda-feira (20/01), pode-se reservar workstations até sábado (31/01)`,
        body: spaceSlotPreReserveBodySchema,
        response: {
          201: spaceSlotPreReserveResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...createSpaceSlotPreReserveSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      // Obter dados do usuário autenticado do contexto da requisição
      const userId = request.requestContext.get('userId') as string
      const userAccount = request.requestContext.get('userAccount') as {
        bookingExceptionUntil: string | null
      } | null

      // Inserir o userId e bookingExceptionUntil no body da requisição
      const body = {
        ...request.body,
        userId,
        bookingExceptionUntil: userAccount?.bookingExceptionUntil ?? null,
      }

      const result = await createSpaceSlotPreReserve(
        {
          body,
        },
        deps,
      )

      return reply.status(201).send(result)
    },
  )
}
