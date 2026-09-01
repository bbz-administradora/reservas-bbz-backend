// src/api/v1/private/reservation/close/space-reservation-close.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  closeSpaceReservation,
  closeSpaceReservationSchema,
} from '@/models/reservation/space-reservation-close-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  spaceReservationCloseBodySchema,
  spaceReservationCloseResponseSchema,
} from '@/schemas/reservation/space-reservation-close-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const spaceSlotRepository = new PgSpaceSlotRepository()
  const spaceRepository = new PgSpacesRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const teamMemberSupervisorsRepository =
    new PgTeamMemberSupervisorsRepository()
  const usersRepository = new PgUsersRepository()
  return {
    spaceReservationRepository,
    spaceSlotRepository,
    spaceRepository,
    teamPositionsRepository,
    teamMemberSupervisorsRepository,
    usersRepository,
  }
}

export async function spaceReservationCloseController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/reservation/close',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'closeSpaceReservation',
        summary: 'Fechar uma reserva de espaço',
        description: `Este endpoint permite que um usuário feche uma reserva de espaço que ele criou.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Funcionalidade**:
  1. Fecha uma reserva existente no status 'reserved'
  2. Atualiza o status para 'closed'
  3. Registra a data e hora de fechamento
  4. Remove os slots de espaço associados (se ainda existirem)

* **Regras de negócio**:
  1. Apenas o criador da reserva pode fechá-la
  2. A reserva deve estar no status 'reserved' (não pode estar já fechada ou cancelada)
  3. O fechamento é definitivo e não pode ser desfeito
  4. Os slots de espaço associados serão excluídos se ainda existirem (podem ter sido removidos por um job agendado)

* **Parâmetros da requisição**:
  - id (opcional): Identificador UUID da reserva a ser fechada
  - spaceSlotIds (opcional): Array de identificadores UUID dos slots associados à reserva

* **Exemplo de uso**:
  - Requisição básica: \`PATCH /v1/private/reservation/close\` com corpo JSON \`{ "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab" }\`
  - Alternativa: \`PATCH /v1/private/reservation/close\` com corpo JSON \`{ "spaceSlotIds": ["a1b2c3d4-e5f6-7890-abcd-1234567890ab"] }\`

* **Formato da resposta**:
  - reservation: Objeto com todas as informações da reserva fechada
  - message: Mensagem informativa de sucesso

* **Notas**:
  - O ID do usuário que fecha a reserva é automaticamente capturado do token JWT
  - O status da reserva será atualizado para 'closed'
  - A data e hora de fechamento (closedAt) serão registradas automaticamente
  - Os slots de espaço serão excluídos apenas se ainda existirem no sistema`,
        body: spaceReservationCloseBodySchema,
        response: {
          200: spaceReservationCloseResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...closeSpaceReservationSchema,
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

      // Invocar o caso de uso
      const result = await closeSpaceReservation(
        {
          body: request.body,
          userId,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
