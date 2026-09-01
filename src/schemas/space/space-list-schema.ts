// src/schemas/space/space-list-schema.ts
import z from 'zod'

// Schema para validar os parâmetros de query
export const spaceListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1000)),
  searchTerm: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    }),
  capacidade: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  type: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'room' || val === 'workstation') return val
      return undefined
    }),
  floor: z.string().optional(),
  zone: z.string().optional(),
})

// Tipagem para os parâmetros de query
export type SpaceListQueryInput = z.infer<typeof spaceListQuerySchema>

// Schema para validar a resposta
export const spaceListResponseSchema = z
  .object({
    spaces: z.array(
      z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        name: z.string(),
        description: z.string().nullable(),
        recursos: z.array(z.string()),
        imagens: z.array(z.string()),
        capacidade: z.number(),
        type: z.enum(['room', 'workstation']),
        floor: z.string().nullable(),
        zone: z.string().nullable(),
        position: z.string().nullable(),
        qrcodeUrl: z.string().nullable(),
        isActive: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
        userName: z.string(),
      }),
    ),
    totalCount: z.number(),
    totalPages: z.number(),
    currentPage: z.number(),
  })
  .describe('Lista de espaços')
