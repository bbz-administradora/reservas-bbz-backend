// src/schemas/space-slot/space-slot-availability-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const spaceSlotAvailabilityParamsSchema = z.object({
  spaceId: z.string().uuid('ID do espaço inválido, deve ser um UUID'),
})

// Tipagem para os parâmetros da URL
export type SpaceSlotAvailabilityParamsInput = z.infer<
  typeof spaceSlotAvailabilityParamsSchema
>

// Schema para validar os parâmetros de query
export const spaceSlotAvailabilityQuerySchema = z.object({
  startDate: z
    .string({
      required_error: 'A data inicial é obrigatória',
    })
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Data inicial inválida, formato correto: YYYY-MM-DD (ex: 2023-08-15)',
    )
    .describe(
      'Data inicial para verificação de disponibilidade no formato YYYY-MM-DD',
    ),
  endDate: z
    .string({
      required_error: 'A data final é obrigatória',
    })
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Data final inválida, formato correto: YYYY-MM-DD (ex: 2023-08-15)',
    )
    .describe(
      'Data final para verificação de disponibilidade no formato YYYY-MM-DD',
    ),
})

// Tipagem para os parâmetros de query
export type SpaceSlotAvailabilityQueryInput = z.infer<
  typeof spaceSlotAvailabilityQuerySchema
>

// Schema para validar a resposta
export const spaceSlotAvailabilityResponseSchema = z.object({
  space: z.object({
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
    capacidade: z.number().describe('Capacidade máxima de pessoas no espaço'),
    isActive: z.boolean().describe('Indica se o espaço está ativo ou inativo'),
    type: z
      .enum(['room', 'workstation'])
      .describe('Tipo de espaço: sala ou estação de trabalho'),
    floor: z
      .string()
      .nullable()
      .describe('Andar onde o espaço está localizado'),
    zone: z.string().nullable().describe('Zona/setor do espaço'),
    position: z.string().nullable().describe('Posição específica do espaço'),
  }),
  slots: z.array(
    z.object({
      id: z.string().uuid().describe('Identificador único do slot'),
      slotStart: z
        .string()
        .describe('Data e hora do slot no formato ISO (UTC)'),
      slotEnd: z.string().describe('Data e hora do slot no formato ISO (UTC)'),
      status: z.enum(['reserved', 'pre_reserved']),
      user: z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          email: z.string().email(),
        })
        .describe(
          'Usuário que fez a pré-reserva (null quando não há pré-reserva)',
        ),
      preReservedUntil: z
        .string()
        .nullable()
        .describe(
          'Data e hora da pré-reserva (null quando não há pré-reserva)',
        ),
    }),
  ),
})

// Tipagem para a resposta
export type SpaceSlotAvailabilityResponse = z.infer<
  typeof spaceSlotAvailabilityResponseSchema
>
