// src/api/v1/private/reservation/cancelled-reservations-list.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getCancelledReservationsListUseCase,
  getCancelledReservationsListUseCaseSchema,
} from '@/models/reservation/cancelled-reservations-list-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  cancelledReservationsListQuerySchema,
  cancelledReservationsListResponseSchema,
} from '@/schemas/reservation/cancelled-reservations-list-schema'
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

export async function cancelledReservationsListController(
  app: FastifyInstance,
) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservations/cancelled/list',
    {
      schema: {
        tags: ['Reservations'],
        operationId: 'cancelledReservationsList',
        summary:
          'Listar cancelamentos de reservas após o prazo de planejamento',
        description: `Este endpoint retorna uma lista paginada de cancelamentos de reservas de workstation efetuados após o prazo de planejamento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Apenas supervisores e diretores podem acessar.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regra de negócio**:
- Colaboradores devem planejar reservas de workstation até quinta-feira da semana anterior
- Cancelamentos feitos após esse prazo são listados neste endpoint
- Supervisores: visualizam apenas cancelamentos da sua equipe
- Diretores: visualizam todos os cancelamentos

**Parâmetros opcionais**:
- \`page\`: Número da página (default: 1)
- \`pageSize\`: Itens por página (default: 10, max: 100)
- \`startDate\`: Data inicial do período (default: início do mês atual)
- \`endDate\`: Data final do período (default: momento atual)
- \`userName\`: Filtro por nome do colaborador
- \`supervisorName\`: Filtro por nome do supervisor
- \`position\`: Filtro por cargo (manager, assistant_manager, assistant)

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        querystring: cancelledReservationsListQuerySchema,
        response: {
          200: cancelledReservationsListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getCancelledReservationsListUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getCancelledReservationsListUseCase(
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
