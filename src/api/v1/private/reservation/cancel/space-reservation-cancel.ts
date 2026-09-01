// src/api/v1/private/reservation/cancel/space-reservation-cancel.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import {
  validateUserRole,
  validateUserRoleSchema,
} from '@/middlewares/validate-user-role'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  cancelSpaceReservation,
  cancelSpaceReservationSchema,
} from '@/models/reservation/space-reservation-cancel-use-case'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import {
  spaceReservationCancelBodySchema,
  spaceReservationCancelResponseSchema,
} from '@/schemas/reservation/space-reservation-cancel-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceReservationRepository = new PgSpaceReservationRepository()
  const spaceSlotRepository = new PgSpaceSlotRepository()

  return {
    spaceReservationRepository,
    spaceSlotRepository,
  }
}

export async function spaceReservationCancelController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/v1/private/reservation/cancel',
    {
      schema: {
        tags: ['Reservation'],
        operationId: 'cancelSpaceReservation',
        summary: 'Cancelar uma reserva de espaço',
        description: `Este endpoint permite que um administrador ou desenvolvedor cancele uma reserva de espaço.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível APENAS a usuários com perfil 'admin' ou 'dev'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Funcionalidade**:
  1. Cancela uma reserva existente no status 'reserved'
  2. Atualiza o status para 'cancelled'
  3. Registra a data e hora de cancelamento
  4. Armazena o motivo do cancelamento
  5. Registra o usuário que realizou o cancelamento
  6. Remove os slots de espaço associados (se ainda existirem)

* **Regras de negócio**:
  1. Apenas usuários administradores ou desenvolvedores podem cancelar reservas
  2. A reserva deve estar no status 'reserved' (não pode estar já fechada ou cancelada)
  3. Um motivo de cancelamento deve ser fornecido
  4. O cancelamento é definitivo e não pode ser desfeito
  5. Os slots de espaço associados serão excluídos se ainda existirem (podem ter sido removidos por um job agendado)

* **Parâmetros da requisição**:
  - id (opcional): Identificador UUID da reserva a ser cancelada
  - spaceSlotIds (opcional): Array de identificadores UUID dos slots associados à reserva
  - cancelReason (obrigatório): Motivo do cancelamento (3 a 500 caracteres)

* **Exemplo de uso**:
  - Requisição usando ID: \`PATCH /v1/private/reservation/cancel\` com corpo JSON:
  \`\`\`json
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    "cancelReason": "Espaço em manutenção emergencial"
  }
  \`\`\`
  - Alternativa: \`PATCH /v1/private/reservation/cancel\` com corpo JSON:
  \`\`\`json
  {
    "spaceSlotIds": ["a1b2c3d4-e5f6-7890-abcd-1234567890ab"],
    "cancelReason": "Espaço em manutenção emergencial"
  }
  \`\`\`

* **Formato da resposta**:
  - reservation: Objeto com todas as informações da reserva cancelada
  - message: Mensagem informativa de sucesso

* **Notas**:
  - O ID do usuário que cancela a reserva é automaticamente capturado do token JWT
  - O status da reserva será atualizado para 'cancelled'
  - A data e hora de cancelamento (cancelledAt) serão registradas automaticamente
  - Os slots de espaço serão excluídos apenas se ainda existirem no sistema`,
        body: spaceReservationCancelBodySchema,
        response: {
          200: spaceReservationCancelResponseSchema,
          ...verifyJWTSchema,
          ...validateUserRoleSchema,
          ...validateUserAccountSchema,
          ...cancelSpaceReservationSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT, validateUserRole(['admin', 'dev'])],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      // Obter o ID do usuário autenticado do contexto da requisição
      const userId = request.requestContext.get('userId') as string

      // Invocar o caso de uso
      const result = await cancelSpaceReservation(
        {
          body: request.body,
          userId,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
