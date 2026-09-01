// src/api/v1/private/space-slot/pre-reserve/delete/space-slot-pre-reserve-delete.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  deleteSpaceSlotPreReserve,
  deleteSpaceSlotPreReserveSchema,
} from '@/models/space-slot/space-slot-pre-reserve-delete-use-case'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import {
  spaceSlotPreReserveDeleteParamsSchema,
  spaceSlotPreReserveDeleteResponseSchema,
} from '@/schemas/space-slot/space-slot-pre-reserve-delete-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceSlotRepository = new PgSpaceSlotRepository()

  return { spaceSlotRepository }
}

export async function spaceSlotPreReserveDeleteController(
  app: FastifyInstance,
) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/v1/private/space-slot/:slotId/pre-reserve',
    {
      schema: {
        tags: ['Space Slot'],
        operationId: 'deleteSpaceSlotPreReserve',
        summary: 'Deletar pré-reserva de slot em um espaço',
        description: `Este endpoint permite que um usuário delete uma pré-reserva de um slot (horário) em um espaço específico.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a qualquer usuário autenticado, com verificação de propriedade ou privilégio administrativo.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.

* **Funcionalidade**:
  1. Deleta uma pré-reserva existente para um slot (horário em um espaço)
  2. Remove completamente o registro do slot do banco de dados
  3. Libera o horário para que outros usuários possam reservá-lo
  4. Apenas o usuário que fez a pré-reserva ou administradores podem deletá-la

* **Fluxo de deleção**:
  1. O usuário solicita a deleção de uma pré-reserva específica através do ID do slot
  2. O sistema extrai automaticamente o ID e perfil do usuário do token JWT
  3. O sistema verifica se o slot existe e está no estado 'pre_reserved'
  4. O sistema verifica se o usuário tem permissão para deletar (é o dono da reserva ou tem perfil admin/dev)
  5. O sistema remove o registro da pré-reserva e libera o horário

* **Parâmetros na rota**:
  - slotId (obrigatório): Identificador UUID do slot pré-reservado

* **Exemplo de uso**:
  - Requisição básica: \`DELETE /v1/private/space-slot/a1b2c3d4-e5f6-7890-abcd-1234567890ab/pre-reserve\`

* **Formato da resposta**:
  - message: Mensagem informativa de sucesso
  - deletedSlotId: UUID do slot que foi deletado

* **Notas**:
  - A deleção é definitiva e não pode ser desfeita
  - Apenas o proprietário da pré-reserva ou usuários com perfil 'admin' ou 'dev' podem deletar
  - Caso o slot já tenha sido completamente reservado (status 'reserved'), este endpoint não funcionará
  - Caso o slot não exista ou já tenha sido deletado, retorna erro 404 (não encontrado)
  - A operação é idempotente (chamar duas vezes não causa erro, mas retorna 404 na segunda vez)`,
        params: spaceSlotPreReserveDeleteParamsSchema,
        response: {
          200: spaceSlotPreReserveDeleteResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...deleteSpaceSlotPreReserveSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      // Obter o ID do usuário autenticado e seu perfil do contexto da requisição
      // Estes valores foram inseridos pelos middlewares verifyJWT e validateUserAccount
      const userId = request.requestContext.get('userId') as string
      const userRole = request.requestContext.get('userRole') as string

      // Chamar o caso de uso com os parâmetros da rota, ID do usuário e perfil
      // Isso permite que o caso de uso verifique se o usuário tem permissão para deletar
      const result = await deleteSpaceSlotPreReserve(
        {
          slotId: request.params.slotId,
          userId,
          userRole,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
