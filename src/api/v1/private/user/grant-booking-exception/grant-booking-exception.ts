// src/api/v1/private/user/grant-booking-exception/grant-booking-exception.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  bookingExceptionUseCase,
  bookingExceptionUseCaseSchema,
} from '@/models/user/booking-exception-use-case'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  bookingExceptionBodySchema,
  bookingExceptionParamsSchema,
  bookingExceptionResponseSchema,
} from '@/schemas/user/booking-exception-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
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

export async function grantBookingExceptionController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/user/:userId/booking-exception',
    {
      schema: {
        tags: ['User'],
        operationId: 'grantBookingException',
        summary: 'Conceder ou revogar exceção de prazo para reservas',
        description: `Este endpoint permite conceder ou revogar uma exceção temporária de prazo para reservas de um colaborador.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**:
  - Admin/Dev: Pode conceder para qualquer usuário com posição em time
  - Diretor: Pode conceder para qualquer usuário com posição em time
  - Supervisor: Apenas para membros da própria equipe
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**O que a exceção libera (semana vigente)**:
- Fazer reserva na sexta-feira
- Fazer reserva na semana atual
- Ignora limite de dias (2-3 por cargo)
- Ignora segunda/sexta obrigatória
- MANTÉM validação de uma reserva de workstation por dia

**Comportamento**:
- \`active: true\`: Seta exceção até sábado da semana (23:59:59)
- \`active: false\`: Remove a exceção (seta NULL)

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: bookingExceptionParamsSchema,
        body: bookingExceptionBodySchema,
        response: {
          200: bookingExceptionResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...bookingExceptionUseCaseSchema,
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

      const result = await bookingExceptionUseCase(
        {
          params: request.params,
          body: request.body,
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
