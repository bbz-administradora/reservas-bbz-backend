import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  listSpaceReservations,
  listSpaceReservationsSchema,
} from '@/models/reservation/space-reservation-list-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  spaceReservationListQuerySchema,
  spaceReservationListResponseSchema,
} from '@/schemas/reservation/space-reservation-list-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const userRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const teamMemberSupervisorsRepository =
    new PgTeamMemberSupervisorsRepository()
  return {
    spaceReservationRepository,
    userRepository,
    teamPositionsRepository,
    teamMemberSupervisorsRepository,
  }
}

export async function spaceReservationListController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservation/list',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'listSpaceReservations',
        summary: 'Listar reservas de espaço',
        description: `Este endpoint permite listar reservas de espaço, com opção de filtrar por usuário.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários autenticados com conta ativa.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Funcionalidade**:
  1. Retorna reservas com paginação
  2. Permite definir parâmetros de paginação (page e pageSize)
  3. Traz informações detalhadas de cada reserva, incluindo dados do espaço e lista de IDs dos slots
  4. Permite filtrar por usuário específico (opcional)
  5. Permite filtrar por espaço específico (opcional)
  6. Permite incluir reservas onde o usuário é convidado (email está em bbz_collaborators ou external_guests)

* **Parâmetros de query**:
  - page (opcional): Número da página para paginação, começando em 1 (padrão: 1)
  - pageSize (opcional): Quantidade de resultados por página, entre 1 e 10000 (padrão: 10000)
  - userId (opcional): ID do usuário para filtrar reservas específicas
  - spaceId (opcional): ID do espaço para filtrar reservas específicas
  - includeUserAsGuest (opcional): Se "true", inclui reservas onde o usuário é convidado

* **Exemplo de uso**:
  - Requisição básica: \`GET /v1/private/reservation/list\` (retorna todas as reservas)
  - Com paginação: \`GET /v1/private/reservation/list?page=2&pageSize=15\`
  - Filtrar por usuário: \`GET /v1/private/reservation/list?userId=123e4567-e89b-12d3-a456-426614174000\`
  - Filtrar por espaço: \`GET /v1/private/reservation/list?spaceId=123e4567-e89b-12d3-a456-426614174000\`
  - Filtrar por usuário incluindo convites: \`GET /v1/private/reservation/list?userId=123e4567-e89b-12d3-a456-426614174000&includeUserAsGuest=true\`

* **Formato da resposta**:
  - reservations: Array com detalhes completos de cada reserva, incluindo array spaceSlotIds e checkInOuts
  - totalCount: Número total de reservas encontradas
  - totalPages: Número total de páginas disponíveis
  - currentPage: Número da página atual

* **Notas**:
  - Sem nenhum parâmetro de filtro, o endpoint retorna TODAS as reservas do sistema
  - Com o parâmetro userId, retorna apenas as reservas do usuário especificado
  - Com o parâmetro spaceId, retorna apenas as reservas do espaço especificado
  - Com userId e includeUserAsGuest=true, também retorna reservas onde o usuário é convidado
  - As reservas são ordenadas da mais recente para a mais antiga
  - Cada reserva agora contém um array spaceSlotIds com os IDs dos slots reservados
  - Cada reserva inclui um array checkInOuts com todos os registros de check-in e check-out relacionados
  - Com teamOnly=true, retorna apenas reservas dos subordinados do usuário autenticado (para supervisores)`,
        querystring: spaceReservationListQuerySchema,
        response: {
          200: spaceReservationListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...listSpaceReservationsSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      // Recuperar dados do usuário autenticado do contexto
      const userAccount = request.requestContext.get('userAccount') as {
        id: string
        role: 'dev' | 'admin' | 'user'
        teamPosition:
          | 'director'
          | 'supervisor'
          | 'manager'
          | 'assistant_manager'
          | 'assistant'
          | null
      }

      // Extrair parâmetros da query
      const {
        page,
        pageSize,
        userId,
        spaceId,
        includeUserAsGuest,
        startDate,
        endDate,
        teamOnly,
      } = request.query

      // Se userId não existir na query, passa null para buscar todas as reservas
      const result = await listSpaceReservations(
        {
          page,
          pageSize,
          userId: userId || null,
          spaceId: spaceId || null,
          includeUserAsGuest,
          startDate,
          endDate,
          teamOnly,
          requestUser: {
            id: userAccount.id,
            role: userAccount.role,
            teamPosition: userAccount.teamPosition,
          },
        },
        deps,
      )
      return reply.status(200).send(result)
    },
  )
}
