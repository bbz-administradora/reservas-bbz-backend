// src/schemas/user/user-absence-schema.ts
import { z } from 'zod'

/**
 * Schema para definir afastamento de usuário
 * - startDate e endDate: período do afastamento (inclusive)
 * - Para remover afastamento, enviar startDate e endDate como null
 */
export const UserSetAbsenceParamsSchema = z.object({
  userId: z.string().uuid({
    message: 'ID do usuário inválido. Deve ser um UUID v4 válido.',
  }),
})

export const UserSetAbsenceBodySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Data de início deve estar no formato YYYY-MM-DD.',
      })
      .nullable()
      .describe(
        'Data de início do afastamento (YYYY-MM-DD) ou null para remover',
      ),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'Data de fim deve estar no formato YYYY-MM-DD.',
      })
      .nullable()
      .describe('Data de fim do afastamento (YYYY-MM-DD) ou null para remover'),
    reason: z
      .string()
      .max(500, {
        message: 'A justificativa deve ter no máximo 500 caracteres.',
      })
      .nullable()
      .optional()
      .describe(
        'Motivo/justificativa do afastamento (férias, licença médica, etc.)',
      ),
  })
  .refine(
    (data) => {
      // Ambos devem ser null ou ambos devem ter valor
      if (data.startDate === null && data.endDate === null) return true
      if (data.startDate !== null && data.endDate !== null) return true
      return false
    },
    {
      message:
        'Ambas as datas devem ser preenchidas ou ambas devem ser nulas para remover o afastamento.',
    },
  )
  .refine(
    (data) => {
      if (data.startDate === null || data.endDate === null) return true
      return new Date(data.startDate) <= new Date(data.endDate)
    },
    {
      message: 'A data de início não pode ser posterior à data de fim.',
    },
  )

export const UserSetAbsenceResponseSchema = z.object({
  message: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().email(),
    absenceStartDate: z.string().nullable(),
    absenceEndDate: z.string().nullable(),
    absenceReason: z.string().nullable(),
  }),
})

// Types
export type UserSetAbsenceParams = z.infer<typeof UserSetAbsenceParamsSchema>
export type UserSetAbsenceBody = z.infer<typeof UserSetAbsenceBodySchema>
export type UserSetAbsenceResponse = z.infer<
  typeof UserSetAbsenceResponseSchema
>

/**
 * Schema para listar usuários afastados
 */
export const UserListAbsencesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .describe('Número da página (padrão: 1)'),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .describe('Itens por página (padrão: 20)'),
  includeExpired: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true')
    .describe('Incluir afastamentos já expirados (padrão: false)'),
})

export const UserListAbsencesResponseSchema = z.object({
  absences: z.array(
    z.object({
      userId: z.string().uuid(),
      userName: z.string().nullable(),
      userEmail: z.string().email(),
      position: z
        .enum([
          'director',
          'supervisor',
          'manager',
          'assistant_manager',
          'assistant',
        ])
        .nullable(),
      supervisorName: z.string().nullable(),
      absenceStartDate: z.string(),
      absenceEndDate: z.string(),
      absenceReason: z.string().nullable(),
      isActive: z
        .boolean()
        .describe('Se o afastamento está ativo (data atual dentro do período)'),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})

export type UserListAbsencesQuery = z.infer<typeof UserListAbsencesQuerySchema>
export type UserListAbsencesResponse = z.infer<
  typeof UserListAbsencesResponseSchema
>
