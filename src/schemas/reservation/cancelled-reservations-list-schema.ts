// src/schemas/reservation/cancelled-reservations-list-schema.ts
import z from 'zod'

/**
 * Schema para query params do endpoint de listagem de cancelamentos
 */
export const cancelledReservationsListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('Número da página (1-indexed).'),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Quantidade de itens por página.'),
  startDate: z
    .string()
    .optional()
    .describe(
      'Data inicial do período de busca (ISO 8601). Filtra por data do cancelamento.',
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      'Data final do período de busca (ISO 8601). Filtra por data do cancelamento.',
    ),
  userName: z
    .string()
    .optional()
    .describe('Filtro por nome do colaborador (busca parcial).'),
  supervisorName: z
    .string()
    .optional()
    .describe('Filtro por nome do supervisor (busca parcial).'),
  position: z
    .enum(['manager', 'assistant_manager', 'assistant'])
    .optional()
    .describe('Filtro por cargo do colaborador.'),
})

export type CancelledReservationsListQuery = z.infer<
  typeof cancelledReservationsListQuerySchema
>

/**
 * Schema para um item da lista de cancelamentos
 */
export const cancelledReservationItemSchema = z.object({
  id: z.string().uuid().describe('ID único da reserva.'),
  userId: z.string().uuid().describe('ID do colaborador.'),
  userName: z.string().describe('Nome do colaborador.'),
  userEmail: z.string().email().describe('E-mail do colaborador.'),
  userPosition: z
    .string()
    .nullable()
    .describe('Cargo do colaborador (manager, assistant_manager, assistant).'),
  supervisorId: z.string().uuid().nullable().describe('ID do supervisor.'),
  supervisorName: z.string().nullable().describe('Nome do supervisor.'),
  supervisorEmail: z.string().nullable().describe('E-mail do supervisor.'),
  spaceId: z.string().uuid().describe('ID do espaço (workstation).'),
  spaceName: z.string().describe('Nome do espaço.'),
  slotStart: z.string().describe('Data/hora de início da reserva (ISO 8601).'),
  slotEnd: z.string().describe('Data/hora de fim da reserva (ISO 8601).'),
  closedAt: z.string().describe('Data/hora do cancelamento (ISO 8601).'),
  planningDeadline: z
    .string()
    .describe('Prazo de planejamento que foi ultrapassado (ISO 8601).'),
})

export type CancelledReservationItem = z.infer<
  typeof cancelledReservationItemSchema
>

/**
 * Schema para resposta do endpoint de listagem de cancelamentos
 */
export const cancelledReservationsListResponseSchema = z.object({
  userType: z
    .enum(['supervisor', 'director'])
    .describe('Tipo de usuário que está consultando.'),
  reservations: z
    .array(cancelledReservationItemSchema)
    .describe('Lista de cancelamentos.'),
  pagination: z.object({
    currentPage: z.number().int().min(1).describe('Página atual.'),
    pageSize: z.number().int().min(1).describe('Itens por página.'),
    totalPages: z.number().int().min(0).describe('Total de páginas.'),
    totalCount: z.number().int().min(0).describe('Total de itens.'),
  }),
  periodStart: z
    .string()
    .describe('Data de início do período consultado (ISO 8601).'),
  periodEnd: z
    .string()
    .describe('Data de fim do período consultado (ISO 8601).'),
})

export type CancelledReservationsListResponse = z.infer<
  typeof cancelledReservationsListResponseSchema
>
