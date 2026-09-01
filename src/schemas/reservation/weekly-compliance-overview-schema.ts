// src/schemas/reservation/weekly-compliance-overview-schema.ts
import z from 'zod'

/**
 * Schema base para dados de compliance
 */
const baseComplianceDataSchema = z.object({
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
})

/**
 * Schema para resposta de colaborador (employee)
 */
const employeeComplianceSchema = baseComplianceDataSchema.extend({
  userType: z
    .literal('employee')
    .describe('Tipo de usuário: colaborador. Campo obrigatório.'),
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
  isCompliant: z
    .boolean()
    .describe(
      'Indica se o colaborador cumpriu a exigência de reservas. Campo obrigatório.',
    ),
  missingDays: z
    .number()
    .int()
    .min(0)
    .describe(
      'Quantidade de dias que ainda faltam reservar. Campo obrigatório.',
    ),
})

/**
 * Schema para resposta de supervisor
 */
const supervisorComplianceSchema = baseComplianceDataSchema.extend({
  userType: z
    .literal('supervisor')
    .describe('Tipo de usuário: supervisor. Campo obrigatório.'),
  teamSummary: z
    .object({
      totalMembers: z
        .number()
        .int()
        .min(0)
        .describe(
          'Total de membros da equipe que devem cumprir a regra. Campo obrigatório.',
        ),
      compliantMembers: z
        .number()
        .int()
        .min(0)
        .describe(
          'Quantidade de membros que cumpriram a regra. Campo obrigatório.',
        ),
      nonCompliantMembers: z
        .number()
        .int()
        .min(0)
        .describe(
          'Quantidade de membros que não cumpriram a regra. Campo obrigatório.',
        ),
    })
    .describe('Resumo de compliance da equipe. Campo obrigatório.'),
})

/**
 * Schema para resposta de diretor
 */
const directorComplianceSchema = baseComplianceDataSchema.extend({
  userType: z
    .literal('director')
    .describe('Tipo de usuário: diretor. Campo obrigatório.'),
  overallSummary: z
    .object({
      totalMembers: z
        .number()
        .int()
        .min(0)
        .describe(
          'Total de colaboradores que devem cumprir a regra. Campo obrigatório.',
        ),
      compliantMembers: z
        .number()
        .int()
        .min(0)
        .describe(
          'Quantidade de colaboradores que cumpriram a regra. Campo obrigatório.',
        ),
      nonCompliantMembers: z
        .number()
        .int()
        .min(0)
        .describe(
          'Quantidade de colaboradores que não cumpriram a regra. Campo obrigatório.',
        ),
    })
    .describe('Resumo de compliance geral. Campo obrigatório.'),
})

/**
 * Schema discriminated union para resposta de overview de compliance
 *
 * Retorna diferentes estruturas baseado no tipo de usuário:
 * - employee: dados de compliance individual
 * - supervisor: resumo da equipe
 * - director: resumo geral
 */
export const weeklyComplianceOverviewResponseSchema = z.discriminatedUnion(
  'userType',
  [
    employeeComplianceSchema,
    supervisorComplianceSchema,
    directorComplianceSchema,
  ],
)

// Types inferidos
export type EmployeeComplianceResponse = z.infer<
  typeof employeeComplianceSchema
>
export type SupervisorComplianceResponse = z.infer<
  typeof supervisorComplianceSchema
>
export type DirectorComplianceResponse = z.infer<
  typeof directorComplianceSchema
>
export type WeeklyComplianceOverviewResponse = z.infer<
  typeof weeklyComplianceOverviewResponseSchema
>
