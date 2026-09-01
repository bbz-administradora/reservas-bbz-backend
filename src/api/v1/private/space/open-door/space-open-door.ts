// src/api/v1/private/space/open-door/space-open-door.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  openDoor,
  openDoorSchema,
} from '@/models/space/space-open-door-use-case'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  spaceOpenDoorQuerySchema,
  spaceOpenDoorResponseSchema,
} from '@/schemas/space/space-open-door-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  const accountRepository = new PgAccountsRepository()
  const userRepository = new PgUsersRepository()
  const spaceCheckInOutRepository = new PgSpaceCheckInOutRepository()
  const spaceReservationRepository = new PgSpaceReservationRepository()

  return {
    spacesRepository,
    accountRepository,
    userRepository,
    spaceCheckInOutRepository,
    spaceReservationRepository,
  }
}

export async function spaceOpenDoorController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/space/open-door',
    {
      schema: {
        tags: ['Space'],
        operationId: 'openDoor',
        summary: 'Gerar código para abertura de porta de um espaço',
        description: `Este endpoint permite gerar um código temporário para abrir a porta de um espaço específico, utilizando integração com a API DLOCK.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user' (com validação adicional para usuários comuns).
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Parâmetros de consulta**:
  - \`spaceName\` (obrigatório): Nome do espaço para abrir a porta
  - \`reservationId\` (opcional): ID da reserva relacionada (obrigatório para usuários comuns)
* **Processo**:
  1. Valida o nome do espaço a ser aberto e o ID da reserva (quando aplicável)
  2. Verifica a role do usuário autenticado:
     - Para usuários 'admin' ou 'dev': acesso liberado sem verificações adicionais
     - Para usuários comuns ('user'): verifica a existência da reserva e do check-in
  3. Para usuários comuns, valida:
     - Se o usuário é proprietário ou convidado da reserva informada
     - Se existe um check-in ativo para esta reserva
     - Se não houver check-in ou o usuário não estiver associado à reserva, não gera o código
  4. Verifica se o espaço existe no banco de dados
  5. Verifica se existe uma conta DLOCK cadastrada no sistema
     - Caso não exista, cria uma nova conta usando as credenciais armazenadas no ambiente
     - Verifica se o usuário com o email configurado para DLOCK existe no sistema
  6. Gerencia o token de acesso à API DLOCK automaticamente:
     - Verifica se o token está próximo de expirar (menos de 30 dias)
     - Realiza refresh automático do token quando necessário
     - Atualiza os dados da conta no banco de dados
  7. Consulta a API DLOCK para obter a lista de fechaduras cadastradas
  8. Identifica a fechadura correspondente ao espaço solicitado através do nome normalizado
  9. Gera um código temporário de acesso através da API DLOCK:
     - Se a solicitação ocorrer antes dos últimos 10 minutos da hora, gera um código válido por 1 hora
     - Se a solicitação ocorrer nos últimos 10 minutos da hora, gera um código válido por 2 horas
  10. Formata a data de expiração no fuso horário de São Paulo
  11. Retorna o código de acesso temporário e informações de expiração

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        querystring: spaceOpenDoorQuerySchema,
        response: {
          200: spaceOpenDoorResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...openDoorSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await openDoor({ query: request.query }, deps, request)

      return reply.status(200).send(result)
    },
  )
}
