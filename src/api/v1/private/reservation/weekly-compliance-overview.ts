// src/api/v1/private/reservation/weekly-compliance-overview.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getWeeklyComplianceOverviewUseCase,
  getWeeklyComplianceOverviewUseCaseSchema,
} from '@/models/reservation/weekly-compliance-overview-use-case'
import { PgOutpostsRepository } from '@/repositories/pg/pg-outposts-repository'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { weeklyComplianceOverviewResponseSchema } from '@/schemas/reservation/weekly-compliance-overview-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const outpostsRepository = new PgOutpostsRepository()

  return {
    usersRepository,
    spaceReservationRepository,
    teamPositionsRepository,
    outpostsRepository,
  }
}

export async function weeklyComplianceOverviewController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservations/weekly-compliance/overview',
    {
      schema: {
        tags: ['Reservations'],
        operationId: 'weeklyComplianceOverview',
        summary: 'Buscar overview de compliance de reservas semanais',
        description: `Este endpoint retorna o status de compliance de reservas semanais do usuário autenticado.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Qualquer usuário autenticado pode consultar.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regra de negócio**:
- Colaboradores (manager, assistant_manager, assistant) devem fazer reservas da próxima semana até quinta-feira
- Gerentes: 2 dias/semana
- Subgerentes e Assistentes: 3 dias/semana
- Supervisores e Diretores: Visualizam resumo da equipe/geral
- Apenas workstations contam para compliance (não salas)

**Retorno baseado no cargo**:
- **Colaborador**: Status individual (dias obrigatórios, reservados, faltantes)
- **Supervisor**: Resumo da equipe (total de membros, compliant, não-compliant)
- **Diretor**: Resumo geral de todos os colaboradores

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        response: {
          200: weeklyComplianceOverviewResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getWeeklyComplianceOverviewUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getWeeklyComplianceOverviewUseCase(
        {
          request,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
