// src/api/v1/private/reservation/check-in-out/space-reservation-check-in-out.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  reservationCheckInOutUseCase,
  reservationCheckInOutUseCaseSchema,
} from '@/models/reservation/space-reservation-check-in-out-use-case'
import { UserAccountContext } from '@/repositories/base/users-repository'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  reservationCheckInOutBodySchema,
  reservationCheckInOutParamsSchema,
  reservationCheckInOutResponseSchema,
} from '@/schemas/reservation/space-reservation-check-in-out-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  // Instanciar repositories necessários
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const spaceCheckInOutRepository = new PgSpaceCheckInOutRepository()
  const spacesRepository = new PgSpacesRepository()
  const spaceSlotRepository = new PgSpaceSlotRepository()

  return {
    spaceReservationRepository,
    spaceCheckInOutRepository,
    spacesRepository,
    spaceSlotRepository,
  }
}

export async function spaceReservationCheckInOutController(
  app: FastifyInstance,
) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/private/reservation/check-in-out/:spaceId',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'reservationCheckInOut',
        summary: 'Realizar check-in ou check-out em uma reserva',
        description: `Endpoint para realizar check-in ou check-out em uma reserva específica.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin', 'dev', 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Recebe o ID da reserva e o tipo de operação ('check-in' ou 'check-out') no body
  2. Verifica se o espaço existe
  3. Busca a reserva específica pelo ID informado
  4. Valida se a reserva pertence ao espaço
  5. Valida se o usuário tem permissão (proprietário ou convidado)
  6. Executa a operação solicitada (check-in ou check-out)
  7. No check-out, a reserva é automaticamente fechada e os slots liberados
  8. Retorna os detalhes da reserva atualizada

**Regras de negócio**:
- Check-in pode ser feito:
  - Workstation: 15 minutos antes até 3 horas após o início da reserva
  - Room: 15 minutos antes até 1 hora após o início da reserva
- Check-out requer check-in prévio
- Check-out deve ser feito no mesmo dia do check-in
- Não é possível fazer múltiplos check-ins ou check-outs na mesma reserva

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: reservationCheckInOutParamsSchema,
        body: reservationCheckInOutBodySchema,
        response: {
          200: reservationCheckInOutResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...reservationCheckInOutUseCaseSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        user: request.requestContext.get('userAccount') as UserAccountContext,
        params: {
          ...(request.params || {}),
        },
        body: {
          ...(request.body || {}),
        },
      }

      const result = await reservationCheckInOutUseCase(inputData, deps)
      return reply.status(200).send(result)
    },
  )
}
