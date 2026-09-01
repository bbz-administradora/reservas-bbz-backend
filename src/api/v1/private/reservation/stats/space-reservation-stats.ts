import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getSpaceReservationStats,
  getSpaceReservationStatsSchema,
} from '@/models/reservation/space-reservation-stats-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { spaceReservationStatsResponseSchema } from '@/schemas/reservation/space-reservation-stats-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceReservationRepository = new PgSpaceReservationRepository()
  return { spaceReservationRepository }
}

export async function spaceReservationStatsController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservation/stats',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'getSpaceReservationStats',
        summary: 'Get reservation stats for the logged user',
        description: `Este endpoint retorna estatísticas de reservas do usuário autenticado.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários autenticados com conta ativa.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Funcionalidade**:
  1. Retorna o total de reservas do usuário
  2. Retorna a próxima reserva futura (data/hora de início mais próxima)
  3. Retorna os três horários de início mais usados pelo usuário para reservas

* **Formato da resposta**:
  - total: número total de reservas
  - nextReservation: data/hora da próxima reserva no formato 'dd/MM/yyyy às HH:mm' ou null
  - mostUsedStartTimes: array com os três horários de início mais usados (formato HH:mm, do menor para o maior)

* **Exemplo de resposta**:
  {
    "total": 12,
    "nextReservation": "01/06/2025 às 10:00",
    "mostUsedStartTimes": ["10:00", "14:00", "16:00"]
  }

* **Notas**:
  - O userId é extraído do JWT do usuário autenticado
  - Se o usuário não tiver reservas futuras, nextReservation será null
  - Se o usuário tiver menos de três horários distintos, o array será preenchido com '00:00' até ter três itens
`,
        response: {
          200: spaceReservationStatsResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getSpaceReservationStatsSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const userId = request.requestContext.get('userId') as string

      const deps = createDependencies()

      const result = await getSpaceReservationStats({ userId }, deps)

      return reply.status(200).send(result)
    },
  )
}
