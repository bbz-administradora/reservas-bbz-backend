import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  listCheckInOutReservations,
  listCheckInOutReservationsSchema,
} from '@/models/reservation/space-reservation-check-in-out-list-use-case'
import { UserAccountContext } from '@/repositories/base/users-repository'
import {
  checkInOutListParamsSchema,
  checkInOutListResponseSchema,
} from '@/schemas/reservation/space-reservation-check-in-out-list-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function spaceReservationCheckInOutListController(
  app: FastifyInstance,
) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservation/check-in-out-list/:spaceId',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'listCheckInOutReservations',
        summary: 'Listar reservas do dia para check-in/check-out',
        description: `Endpoint dedicado para a tela de check-in/check-out.

Retorna apenas as reservas do dia atual (horário de Brasília) do usuário autenticado
no espaço informado. O userId e o cálculo da data são feitos no servidor, eliminando
qualquer possibilidade de erro no client.

* **Segurança**: Protegido por autenticação JWT e CSRF.
* **Filtros aplicados no servidor**:
  - Espaço informado via parâmetro
  - Usuário autenticado (JWT) — como dono ou convidado
  - Apenas reservas com status 'reserved'
  - Apenas reservas do dia atual (BRT)`,
        security: [{ bearerAuth: [] }],
        params: checkInOutListParamsSchema,
        response: {
          200: checkInOutListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...listCheckInOutReservationsSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const user = request.requestContext.get(
        'userAccount',
      ) as UserAccountContext

      const result = await listCheckInOutReservations({
        user,
        params: request.params,
      })

      return reply.status(200).send(result)
    },
  )
}
