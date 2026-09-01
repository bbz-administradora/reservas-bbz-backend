// src/api/v1/private/user/absence/user-absence.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  userListAbsencesUseCase,
  userListAbsencesUseCaseSchema,
} from '@/models/user/user-list-absences-use-case'
import {
  userSetAbsenceUseCase,
  userSetAbsenceUseCaseSchema,
} from '@/models/user/user-set-absence-use-case'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  UserListAbsencesQuerySchema,
  UserListAbsencesResponseSchema,
  UserSetAbsenceBodySchema,
  UserSetAbsenceParamsSchema,
  UserSetAbsenceResponseSchema,
} from '@/schemas/user/user-absence-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

function createDependencies() {
  const usersRepository = new PgUsersRepository()
  const teamPositionsRepository = new PgTeamPositionsRepository()
  const teamMemberSupervisorsRepository =
    new PgTeamMemberSupervisorsRepository()
  return {
    usersRepository,
    teamPositionsRepository,
    teamMemberSupervisorsRepository,
  }
}

export async function userAbsenceController(app: FastifyInstance) {
  /**
   * PUT /v1/private/user/:userId/absence
   * Define ou remove afastamento de um usuário
   */
  app.withTypeProvider<ZodTypeProvider>().put(
    '/v1/private/user/:userId/absence',
    {
      schema: {
        tags: ['User'],
        operationId: 'setUserAbsence',
        summary: 'Definir ou remover afastamento de usuário',
        description: `Este endpoint permite definir ou remover o período de afastamento de um usuário (férias, licença, etc.).

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**:
  - Admin/Dev: Pode definir para qualquer usuário
  - Diretor: Pode definir para qualquer usuário
  - Supervisor: Apenas para membros da própria equipe
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Efeitos do afastamento**:
- Usuário não pode fazer novas reservas de WORKSTATION durante o período
- Usuário é REMOVIDO de todos os indicadores de compliance:
  - Compliance semanal (não conta como não-compliant)
  - Checkout antecipado (ocorrências não aparecem)
  - Cancelamentos fora do prazo (não conta nos indicadores)
- Ao logar, usuário vê alerta informando o afastamento

**Comportamento**:
- Enviar startDate e endDate: Define o período de afastamento
- Enviar startDate e endDate como null: Remove o afastamento`,
        security: [{ bearerAuth: [] }],
        params: UserSetAbsenceParamsSchema,
        body: UserSetAbsenceBodySchema,
        response: {
          200: UserSetAbsenceResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...userSetAbsenceUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await userSetAbsenceUseCase(
        {
          request,
          params: request.params,
          body: request.body,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )

  /**
   * GET /v1/private/user/absences
   * Lista usuários com afastamento
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/user/absences',
    {
      schema: {
        tags: ['User'],
        operationId: 'listUserAbsences',
        summary: 'Listar usuários afastados',
        description: `Este endpoint lista todos os usuários com afastamento definido.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**:
  - Admin/Dev: Veem todos os afastamentos
  - Diretor: Vê todos os afastamentos
  - Supervisor: Vê apenas afastamentos da própria equipe
* **Paginação**: Suporta paginação via query params (page, pageSize)
* **Filtros**:
  - includeExpired: Se true, inclui afastamentos já expirados (padrão: false)`,
        security: [{ bearerAuth: [] }],
        querystring: UserListAbsencesQuerySchema,
        response: {
          200: UserListAbsencesResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...userListAbsencesUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await userListAbsencesUseCase(
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
