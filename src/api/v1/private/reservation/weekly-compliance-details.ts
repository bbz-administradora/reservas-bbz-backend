// src/api/v1/private/reservation/weekly-compliance-details.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getWeeklyComplianceDetailsUseCase,
  getWeeklyComplianceDetailsUseCaseSchema,
} from '@/models/reservation/weekly-compliance-details-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  weeklyComplianceDetailsQuerySchema,
  weeklyComplianceDetailsResponseSchema,
} from '@/schemas/reservation/weekly-compliance-details-schema'
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

export async function weeklyComplianceDetailsController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservations/weekly-compliance/details',
    {
      schema: {
        tags: ['Reservations'],
        operationId: 'weeklyComplianceDetails',
        summary: 'Buscar detalhes de compliance de reservas semanais',
        description: `Este endpoint retorna a lista detalhada de colaboradores com status de compliance de reservas semanais.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Apenas supervisores e diretores podem acessar.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regra de negócio**:
- Colaboradores (manager, assistant_manager, assistant) devem fazer reservas da próxima semana até quinta-feira
- Gerentes: 2 dias/semana
- Subgerentes e Assistentes: 3 dias/semana
- Apenas workstations contam para compliance (não salas)

**Retorno baseado no cargo**:
- **Supervisor**: Lista membros da sua equipe com status de compliance
- **Diretor**: Lista todos os colaboradores com status de compliance
- Outros cargos recebem erro 403 (Forbidden)

**Query params**:
- \`page\`: Número da página (padrão: 1)
- \`pageSize\`: Registros por página (padrão: 20)
- \`onlyNonCompliant\`: Se true, retorna apenas não-compliant (padrão: false)
- \`week\`: Qual semana consultar: "next" para próxima semana (padrão), "current" para semana vigente
- \`supervisorName\`: Filtrar por nome do supervisor (busca parcial)
- \`userName\`: Filtrar por nome do colaborador (busca parcial)
- \`position\`: Filtrar por cargo (manager, assistant_manager, assistant)

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        querystring: weeklyComplianceDetailsQuerySchema,
        response: {
          200: weeklyComplianceDetailsResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getWeeklyComplianceDetailsUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const {
        page,
        pageSize,
        onlyNonCompliant,
        week,
        supervisorName,
        userName,
        position,
      } = request.query

      const result = await getWeeklyComplianceDetailsUseCase(
        {
          request,
          page,
          pageSize,
          onlyNonCompliant,
          week,
          supervisorName,
          userName,
          position,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
