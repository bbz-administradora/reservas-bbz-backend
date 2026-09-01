// src/schemas/space/space-open-door-schema.ts
import z from 'zod'

// Schema para validar os parâmetros de query
export const spaceOpenDoorQuerySchema = z.object({
  spaceName: z
    .string({
      required_error: 'O preenchimento do nome do espaço é obrigatório.',
    })
    .min(3, 'O nome do espaço deve ter pelo menos 3 caracteres')
    .max(100, 'O nome do espaço deve ter no máximo 100 caracteres'),
  reservationId: z
    .string()
    .uuid('O ID da reserva deve ser um UUID válido')
    .describe('ID da reserva para a qual o código de abertura é gerado'),
})

// Tipagem para os parâmetros de query
export type SpaceOpenDoorQueryInput = z.infer<typeof spaceOpenDoorQuerySchema>

// Schema para validar a resposta
export const spaceOpenDoorResponseSchema = z
  .object({
    space: z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.enum(['room', 'workstation']),
    }),
    doorCode: z.string(),
    expiresAt: z.string(),
    message: z.string(),
  })
  .describe('Código de abertura da porta gerado com sucesso')
