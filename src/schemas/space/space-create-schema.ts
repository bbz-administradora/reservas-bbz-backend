// src/schemas/space/space-create-schema.ts
import z from 'zod'

// Schema para validar o corpo da requisição
export const spaceCreateBodySchema = z.object({
  name: z
    .string({ required_error: 'O preenchimento do nome é obrigatório.' })
    .min(3, 'O nome do espaço deve ter pelo menos 3 caracteres')
    .max(100, 'O nome do espaço deve ter no máximo 100 caracteres'),
  description: z
    .string()
    .max(500, 'A descrição deve ter no máximo 500 caracteres')
    .nullable()
    .optional(),
  recursos: z.array(z.string()).optional().default([]),
  imagens: z
    .array(z.string())
    .max(5, 'Você pode enviar no máximo 5 imagens')
    .optional()
    .default([]),
  capacidade: z
    .number({
      required_error: 'O preenchimento da capacidade é obrigatório.',
    })
    .int('A capacidade deve ser um número inteiro')
    .positive('A capacidade deve ser um número positivo'),
  type: z
    .enum(['room', 'workstation'], {
      required_error: 'O tipo do espaço é obrigatório.',
    })
    .describe(
      'Tipo do espaço: sala (room) ou estação de trabalho (workstation)',
    ),
  floor: z
    .string()
    .max(10, 'O andar deve ter no máximo 10 caracteres')
    .nullable()
    .optional()
    .describe('Andar onde o espaço está localizado'),
  zone: z
    .string()
    .max(50, 'A zona/setor deve ter no máximo 50 caracteres')
    .nullable()
    .optional()
    .describe('Zona ou setor onde o espaço está localizado'),
  position: z
    .string()
    .max(50, 'A posição deve ter no máximo 50 caracteres')
    .nullable()
    .optional()
    .describe('Posição específica do espaço'),
  isActive: z.boolean().optional().default(true),
})

// Tipagem para o corpo da requisição
export type SpaceCreateBodyInput = z.infer<typeof spaceCreateBodySchema>

// Schema para validar a resposta
export const spaceCreateResponseSchema = z
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
    message: z.string(),
  })
  .describe('Espaço criado com sucesso')
