// src/api/v1/private/space-slot/availability
import {
  validateUserAccount,
  validateUserAccountSchema,
} from '@/middlewares/validate-user-account'
import { verifyJWT, verifyJWTSchema } from '@/middlewares/verify-jwt'
import {
  getSpaceSlotAvailability,
  getSpaceSlotAvailabilitySchema,
} from '@/models/space-slot/space-slot-availability-use-case'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  spaceSlotAvailabilityParamsSchema,
  spaceSlotAvailabilityQuerySchema,
  spaceSlotAvailabilityResponseSchema,
} from '@/schemas/space-slot/space-slot-availability-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export function createDependencies() {
  const spacesRepository = new PgSpacesRepository()
  const spaceSlotRepository = new PgSpaceSlotRepository()

  return { spacesRepository, spaceSlotRepository }
}

export async function spaceSlotAvailabilityController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/private/space-slot/:spaceId/availability',
    {
      schema: {
        tags: ['Space Slot'],
        operationId: 'getSpaceSlotAvailability',
        summary:
          'Visualizar disponibilidade detalhada de um espaço específico em um período',
        description: `Este endpoint retorna informações detalhadas sobre a disponibilidade de um espaço específico em um intervalo de datas, mostrando slots ocupados (reservados ou pré-reservados).

* **Segurança**: Requer autenticação via JWT.
* **Autorização**: Acessível a usuários com conta ativa.

* **Funcionalidade**:
  1. Retorna detalhes completos do espaço solicitado (ID, nome, descrição, recursos, etc.)
  2. Lista todos os slots ocupados (reservados ou pré-reservados) no período informado
  3. Para cada slot ocupado, fornece informações do usuário responsável pela reserva
  4. Diferencia entre slots com status 'reserved' (confirmados) e 'pre_reserved' (temporários)

* **Parâmetros**:
  - spaceId (obrigatório, path): Identificador UUID do espaço
  - startDate (obrigatório, query): Data inicial no formato YYYY-MM-DD
  - endDate (obrigatório, query): Data final no formato YYYY-MM-DD

* **Exemplo de uso**:
  - Consultar período: \`GET /v1/private/space-slot/a1b2c3d4-e5f6-7890-abcd-1234567890ab/availability?startDate=2023-08-15&endDate=2023-08-20\`
  - Consultar único dia: \`GET /v1/private/space-slot/a1b2c3d4-e5f6-7890-abcd-1234567890ab/availability?startDate=2023-08-15&endDate=2023-08-15\`

* **Formato da resposta**:
  - space: Objeto com informações do espaço (id, nome, recursos, capacidade, etc.)
  - slots: Array de slots ocupados no período, contendo:
    - id: Identificador UUID do slot
    - date: Data do slot (YYYY-MM-DD)
    - time: Horário (HH:MM formato 24h)
    - status: Estado ('reserved' ou 'pre_reserved')
    - preReservedBy: Usuário que fez a reserva (id, nome, email)
    - preReservedUntil: Data e hora de expiração da pré-reserva

* **Informações adicionais**:
  - As datas no formato YYYY-MM-DD são convertidas para o fuso horário adequado no processamento
  - São retornados apenas os slots que já estão ocupados (não mostra horários disponíveis)
  - Um slot em estado 'pre_reserved' tem prazo de expiração e pode se tornar disponível novamente se não for confirmado

* **Limites de consulta por tipo de espaço**:
  - **Salas de reunião (room)**: Período máximo de 7 dias corridos
  - **Estações de trabalho (workstation)**: Período até o sábado da próxima semana (considerando semana de domingo a sábado)
  - Exemplo para workstation: Se hoje é segunda (20/01), pode consultar até sábado (31/01)`,
        params: spaceSlotAvailabilityParamsSchema,
        querystring: spaceSlotAvailabilityQuerySchema,
        response: {
          200: spaceSlotAvailabilityResponseSchema,
          ...verifyJWTSchema,
          ...validateUserAccountSchema,
          ...getSpaceSlotAvailabilitySchema,
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [verifyJWT],
      preHandler: [validateUserAccount()],
    },
    async (request, reply) => {
      const deps = createDependencies()

      const result = await getSpaceSlotAvailability(
        {
          params: request.params,
          query: request.query,
        },
        deps,
      )

      return reply.status(200).send(result)
    },
  )
}
