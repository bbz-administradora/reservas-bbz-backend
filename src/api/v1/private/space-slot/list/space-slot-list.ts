// src/api/v1/private/space-slot/list/space-slot-list.ts
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  listAvailableSpaces,
  listSpaceSlotsSchema,
} from '@/models/space-slot/space-slot-list-use-case'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import {
  spaceSlotListQuerySchema,
  spaceSlotListResponseSchema,
} from '@/schemas/space-slot/space-slot-list-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spaceSlotRepository = new PgSpaceSlotRepository()
  return { spaceSlotRepository }
}

export async function spaceSlotListController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/space-slot/list',
    {
      schema: {
        tags: ['Space Slot'],
        operationId: 'listSpaceSlots',
        summary: 'Listar espaços disponíveis por data ou horário específico',
        description: `Este endpoint permite listar espaços disponíveis para uma data e, opcionalmente, um horário específico, com suporte a paginação.

* **Segurança**: Protegido por autenticação JWT (token de sessão) e CSRF via cookie/header.
* **Autorização**: Acessível a usuários com perfil 'admin', 'dev' ou 'user'.
* **Validação de conta**: Verifica se a conta do usuário autenticado está ativa e não requer reset de senha.
* **Regras de busca**:
  1. Quando a data é fornecida com hora zerada (00:00:00), retorna espaços com pelo menos um horário livre entre 07:00 e 20:00
  2. Quando data e hora específica são fornecidos, retorna espaços disponíveis nesse horário específico
  3. Apenas espaços ativos (is_active = true) são considerados
  4. Espaços pré-reservados ou reservados para o horário solicitado são excluídos dos resultados

* **Parâmetros**:
  - datetime (obrigatório): String ISO com timezone para data/hora
  - page (opcional): Número da página para paginação, começando em 1 (padrão: 1)
  - pageSize (opcional): Quantidade de resultados por página, entre 1 e 100 (padrão: 12)
  - type (opcional): Tipo de espaço, 'room' para salas ou 'workstation' para estações de trabalho (padrão: 'room')

* **Exemplo de uso**:
  - Consulta por data: \`GET /v1/private/space-slot/list?datetime=2025-05-22T00:00:00-03:00\`
  - Consulta por horário específico: \`GET /v1/private/space-slot/list?datetime=2025-05-22T14:30:00-03:00\`
  - Com paginação: \`GET /v1/private/space-slot/list?datetime=2025-05-22T00:00:00-03:00&page=2&pageSize=10\`
  - Filtro por tipo: \`GET /v1/private/space-slot/list?datetime=2025-05-22T00:00:00-03:00&type=workstation\`

* **Formato da resposta**:
  - spaces: Array de objetos representando os espaços disponíveis com suas propriedades
  - totalCount: Número total de espaços disponíveis
  - totalPages: Número total de páginas disponíveis
  - currentPage: Página atual sendo exibida
  - message: Mensagem de sucesso ou informação adicional

* **Notas**:
  - O parâmetro datetime deve ser uma string ISO com timezone (exemplo: "2025-05-22T00:00:00-03:00")
  - Se a hora for 00:00:00, o sistema busca espaços com pelo menos um horário livre no dia
  - Se a hora for diferente de 00:00:00 (ex: 14:30:00), o sistema busca espaços livres especificamente nesse horário
  - A duração padrão de cada slot é de 1 hora
  - A capacidade máxima de um espaço pode afetar sua disponibilidade`,
        querystring: spaceSlotListQuerySchema,
        response: {
          200: spaceSlotListResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...listSpaceSlotsSchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()
      const result = await listAvailableSpaces({ query: request.query }, deps)

      return reply.status(200).send(result)
    },
  )
}
