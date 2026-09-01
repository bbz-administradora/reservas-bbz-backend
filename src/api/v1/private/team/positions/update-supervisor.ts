// src/api/v1/private/team/positions/update-supervisor.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  updateSupervisorUseCase,
  updateSupervisorUseCaseSchema,
} from '@/models/team/positions'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  updateSupervisorBodySchema,
  updateSupervisorParamsSchema,
  updateSupervisorResponseSchema,
} from '@/schemas/team/positions'
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

export async function updateSupervisorController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/team/positions/:userId/supervisor',
    {
      schema: {
        tags: ['Team'],
        operationId: 'updateSupervisor',
        summary: 'Atualizar o supervisor de um membro da equipe',
        description: `Este endpoint permite atualizar (ou atribuir) o chefe imediato de um membro da equipe de atendimento.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Apenas usuários com role admin ou dev podem atualizar supervisores.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa.

**Regras de negócio**:
1. Apenas admin/dev podem atualizar supervisores
2. O usuário alvo deve ter uma posição na equipe
3. O supervisor informado deve ter uma posição válida na hierarquia
4. Director não pode ter supervisor (está no topo da hierarquia)
5. Se o membro já tinha um supervisor, o vínculo anterior é removido

**Hierarquia de supervisão**:
- Supervisor → reporta ao Diretor
- Gerente → reporta ao Supervisor
- Subgerente → reporta ao Gerente
- Assistente → reporta ao Gerente ou Subgerente

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: updateSupervisorParamsSchema,
        body: updateSupervisorBodySchema,
        response: {
          200: updateSupervisorResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...updateSupervisorUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await updateSupervisorUseCase(
        {
          request,
          params: request.params,
          data: request.body,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
