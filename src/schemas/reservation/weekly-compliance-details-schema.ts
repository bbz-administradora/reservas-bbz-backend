// src/schemas/reservation/weekly-compliance-details-schema.ts
import z from 'zod'

/**
 * Schema para representar um membro não-compliant
 */
export const nonCompliantMemberSchema = z.object({
  userId: z.string().describe('ID do usuário. Campo obrigatório.'),
  userName: z
    .string()
    .nullable()
    .describe('Nome do usuário. Campo obrigatório, pode ser nulo.'),
  userEmail: z.string().describe('Email do usuário. Campo obrigatório.'),
  position: z.string().describe('Cargo do colaborador. Campo obrigatório.'),
  supervisorName: z
    .string()
    .nullable()
    .describe('Nome do supervisor imediato. Campo obrigatório, pode ser nulo.'),
  requiredDays: z
    .number()
    .int()
    .min(0)
    .describe(
      'Quantidade de dias obrigatórios de reserva para este cargo. Campo obrigatório.',
    ),
  reservedDays: z
    .number()
    .int()
    .min(0)
    .describe(
      'Quantidade de dias já reservados para a próxima semana. Campo obrigatório.',
    ),
  missingDays: z
    .number()
    .int()
    .min(0)
    .describe(
      'Quantidade de dias que ainda faltam reservar. Campo obrigatório.',
    ),
  isCompliant: z
    .boolean()
    .describe(
      'Indica se o colaborador cumpriu a exigência de reservas. Campo obrigatório.',
    ),
})

/**
 * Schema para query params da requisição
 */
export const weeklyComplianceDetailsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .describe('Número da página. Campo opcional, padrão: 1.'),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .describe('Tamanho da página. Campo opcional, padrão: 20.'),
  onlyNonCompliant: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true')
    .describe(
      'Se true, retorna apenas membros não-compliant. Campo opcional, padrão: false.',
    ),
  week: z
    .enum(['next', 'current'])
    .optional()
    .default('next')
    .describe(
      'Qual semana consultar: "next" para próxima semana (padrão), "current" para semana vigente. Campo opcional.',
    ),
  supervisorName: z
    .string()
    .optional()
    .describe(
      'Filtrar por nome do supervisor (busca parcial, case-insensitive). Campo opcional.',
    ),
  userName: z
    .string()
    .optional()
    .describe(
      'Filtrar por nome do colaborador (busca parcial, case-insensitive). Campo opcional.',
    ),
  position: z
    .string()
    .optional()
    .describe(
      'Filtrar por cargo do colaborador (manager, assistant_manager, assistant). Campo opcional.',
    ),
})

/**
 * Schema para representar um supervisor na lista de filtros
 */
export const supervisorFilterSchema = z.object({
  name: z.string().describe('Nome do supervisor.'),
  count: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de colaboradores sob este supervisor.'),
  compliantCount: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de colaboradores em dia sob este supervisor.'),
  nonCompliantCount: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de colaboradores pendentes sob este supervisor.'),
})

/**
 * Schema para representar estatísticas por cargo
 */
export const positionStatsSchema = z.object({
  position: z.string().describe('Cargo do colaborador.'),
  label: z.string().describe('Label do cargo em português.'),
  count: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade total de colaboradores com este cargo.'),
  compliantCount: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de colaboradores em dia com este cargo.'),
  nonCompliantCount: z
    .number()
    .int()
    .min(0)
    .describe('Quantidade de colaboradores pendentes com este cargo.'),
})

/**
 * Schema para resposta de detalhes de compliance
 */
export const weeklyComplianceDetailsResponseSchema = z.object({
  nextWeekStart: z
    .string()
    .describe(
      'Data de início da próxima semana útil no formato ISO 8601. Campo obrigatório.',
    ),
  nextWeekEnd: z
    .string()
    .describe(
      'Data de fim da próxima semana útil no formato ISO 8601. Campo obrigatório.',
    ),
  members: z
    .array(nonCompliantMemberSchema)
    .describe('Lista de membros com dados de compliance. Campo obrigatório.'),
  supervisors: z
    .array(supervisorFilterSchema)
    .describe(
      'Lista de supervisores disponíveis para filtro (apenas para diretores). Campo obrigatório.',
    ),
  positionStats: z
    .array(positionStatsSchema)
    .describe(
      'Estatísticas de compliance agregadas por cargo. Campo obrigatório.',
    ),
  totalCount: z
    .number()
    .int()
    .min(0)
    .describe('Total de registros disponíveis. Campo obrigatório.'),
  compliantCount: z
    .number()
    .int()
    .min(0)
    .describe('Total de colaboradores em dia. Campo obrigatório.'),
  nonCompliantCount: z
    .number()
    .int()
    .min(0)
    .describe('Total de colaboradores pendentes. Campo obrigatório.'),
  totalPages: z
    .number()
    .int()
    .min(0)
    .describe('Total de páginas disponíveis. Campo obrigatório.'),
  currentPage: z
    .number()
    .int()
    .min(1)
    .describe('Página atual. Campo obrigatório.'),
})

// Types inferidos
export type NonCompliantMember = z.infer<typeof nonCompliantMemberSchema>
export type SupervisorFilter = z.infer<typeof supervisorFilterSchema>
export type PositionStats = z.infer<typeof positionStatsSchema>
export type WeeklyComplianceDetailsQuery = z.infer<
  typeof weeklyComplianceDetailsQuerySchema
>
export type WeeklyComplianceDetailsResponse = z.infer<
  typeof weeklyComplianceDetailsResponseSchema
>
