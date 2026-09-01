// src/schemas/space-slot/space-slot-list-schema.ts
import z from 'zod'

// Schema para validar os parâmetros de query
export const spaceSlotListQuerySchema = z.object({
  datetime: z
    .string({
      required_error: 'Data/hora é obrigatória',
    })
    .datetime({
      offset: true,
      message: 'Data/hora inválida, deve ser uma string ISO com timezone',
    })
    .describe(
      'Data/hora no formato ISO com timezone (suporta formatos como -03:00, +00:00 ou Z). ' +
        'Se enviar apenas a data com hora zerada (00:00:00), retorna espaços com pelo menos um horário disponível nessa data. ' +
        'Se enviar data com uma hora específica, retorna espaços disponíveis nesse horário específico. ' +
        'Exemplo para data: "2025-05-22T00:00:00-03:00", exemplo para hora específica: "2025-05-22T14:00:00-03:00"',
    ),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .describe('Número da página para paginação, começando em 1 (padrão: 1)'),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 12))
    .describe(
      'Quantidade de resultados por página, entre 1 e 100 (padrão: 12)',
    ),
  type: z
    .enum(['room', 'workstation'])
    .optional()
    .default('room')
    .describe('Tipo de espaço: sala ou estação de trabalho (padrão: room)'),
})

// Tipagem para os parâmetros de query
export type SpaceSlotListQueryInput = z.infer<typeof spaceSlotListQuerySchema>

// Schema para validar a resposta
export const spaceSlotListResponseSchema = z
  .object({
    spaces: z
      .array(
        z.object({
          id: z.string().uuid().describe('Identificador único do espaço'),
          name: z.string().describe('Nome do espaço'),
          description: z
            .string()
            .nullable()
            .describe('Descrição do espaço (pode ser nulo)'),
          recursos: z
            .array(z.string())
            .describe('Lista de recursos disponíveis no espaço'),
          imagens: z.array(z.string()).describe('URLs das imagens do espaço'),
          capacidade: z
            .number()
            .describe('Capacidade máxima de pessoas no espaço'),
          type: z
            .enum(['room', 'workstation'])
            .describe('Tipo de espaço: sala ou estação de trabalho'),
          floor: z
            .string()
            .nullable()
            .describe('Andar onde o espaço está localizado'),
          zone: z.string().nullable().describe('Zona/setor do espaço'),
          position: z
            .string()
            .nullable()
            .describe('Posição específica do espaço'),
        }),
      )
      .describe('Array de espaços disponíveis no período solicitado'),
    totalCount: z
      .number()
      .describe('Número total de espaços disponíveis para a consulta'),
    totalPages: z
      .number()
      .describe('Número total de páginas com base no tamanho de página'),
    currentPage: z.number().describe('Número da página atual sendo exibida'),
    message: z
      .string()
      .describe('Mensagem informativa sobre o resultado da operação'),
  })
  .describe('Lista paginada de espaços disponíveis com metadados')
