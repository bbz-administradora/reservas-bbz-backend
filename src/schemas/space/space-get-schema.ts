// src/schemas/space/space-get-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const spaceGetParamsSchema = z.object({
  id: z.string().uuid('ID inválido, deve ser um UUID'),
})

// Tipagem para os parâmetros da URL
export type SpaceGetParamsInput = z.infer<typeof spaceGetParamsSchema>

// Schema para validar a resposta
export const spaceGetResponseSchema = z
  .object({
    space: z.object({
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
  })
  .describe('Detalhes do espaço')
