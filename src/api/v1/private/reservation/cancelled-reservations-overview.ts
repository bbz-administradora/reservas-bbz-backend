// src/api/v1/private/reservation/cancelled-reservations-overview.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getCancelledReservationsOverviewUseCase,
  getCancelledReservationsOverviewUseCaseSchema,
} from '@/models/reservation/cancelled-reservations-overview-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  cancelledReservationsOverviewQuerySchema,
  cancelledReservationsOverviewResponseSchema,
} from '@/schemas/reservation/cancelled-reservations-overview-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()

  return {
    spaceReservationRepository,
    teamPositionsRepository,
  }
}

export async function cancelledReservationsOverviewController(
  app: FastifyInstance,
) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservations/cancelled/overview',
    {
      schema: {
        tags: ['Reservations'],
        operationId: 'cancelledReservationsOverview',
        summary: 'Buscar overview de cancelamentos de reservas após o prazo',
        description: `Este endpoint retorna um resumo de cancelamentos de reservas de workstation efetuados após o prazo de planejamento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Apenas supervisores e diretores podem acessar.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regra de negócio**:
- Colaboradores devem planejar reservas de workstation até quinta-feira da semana anterior
- Cancelamentos feitos após esse prazo são contabilizados neste indicador
- Supervisores: visualizam apenas cancelamentos da sua equipe
- Diretores: visualizam todos os cancelamentos

**Parâmetros opcionais**:
- \`startDate\`: Data inicial do período (default: início do mês atual)
- \`endDate\`: Data final do período (default: momento atual)

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        querystring: cancelledReservationsOverviewQuerySchema,
        response: {
          200: cancelledReservationsOverviewResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getCancelledReservationsOverviewUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getCancelledReservationsOverviewUseCase(
        {
          request,
          query: request.query,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
