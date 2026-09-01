// src/api/v1/private/reservation/get/reservation-get.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getSpaceReservationDetail,
  getSpaceReservationDetailSchema,
} from '@/models/reservation/space-reservation-get-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import {
  reservationGetDetailParamsSchema,
  reservationGetDetailResponseSchema,
} from '@/schemas/reservation/space-reservation-get-detail-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceReservationRepository = new PgSpaceReservationRepository()

  return { spaceReservationRepository }
}

export async function spaceReservationGetController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/reservation/:id',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'reservationGetDetail',
        summary: 'Obter detalhes de uma reserva',
        description: `Retorna os detalhes completos de uma reserva específica, incluindo informações do espaço, usuário, status e timestamps.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Restrito a usuários com perfil 'admin', 'dev', 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Processo**:
  1. Valida o ID da reserva fornecido nos parâmetros
  2. Busca os detalhes completos da reserva no banco de dados
  3. Retorna os dados detalhados da reserva, incluindo informações do espaço e usuário

**Middlewares aplicados**:
- \`verifyJWT\`: Valida o token JWT e extrai os dados do usuário autenticado
- \`validateUserRole\`: Restringe acesso aos perfis especificados
- \`validateUserAccount\`: Verifica se a conta do usuário autenticado está ativa`,
        security: [{ bearerAuth: [] }],
        params: reservationGetDetailParamsSchema,
        response: {
          200: reservationGetDetailResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getSpaceReservationDetailSchema,
        },
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const inputData = {
        data: {
          ...(request.params || {}),
        },
      }

      const result = await getSpaceReservationDetail(inputData, deps)

      return reply.status(200).send(result)
    },
  )
}
