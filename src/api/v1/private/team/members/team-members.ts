// src/api/v1/private/team/members/team-members.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  teamMembersUseCase,
  teamMembersUseCaseSchema,
} from '@/models/team/team-members-use-case'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { teamMembersResponseSchema } from '@/schemas/team/team-members-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const teamMemberSupervisorsRepository =
    new PgTeamMemberSupervisorsRepository()

  return {
    teamPositionsRepository,
    teamMemberSupervisorsRepository,
  }
}

export async function teamMembersController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/team/members',
    {
      schema: {
        tags: ['Team'],
        operationId: 'getTeamMembers',
        summary: 'Listar membros da equipe para gestão',
        description: `Este endpoint retorna a lista de membros da equipe que o usuário logado pode gerenciar.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**:
  - Admin/Dev: Vê todos os usuários com posição em time
  - Diretor: Vê todos os usuários com posição em time
  - Supervisor: Vê apenas subordinados da própria equipe
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Dados retornados**:
- ID, nome, email e posição de cada membro
- Status da exceção de prazo (bookingExceptionUntil)

**Uso principal**: Tela de "Liberar Regras de Reserva"

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        response: {
          200: teamMembersResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...teamMembersUseCaseSchema,
        },
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

      const result = await teamMembersUseCase(
        {
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
