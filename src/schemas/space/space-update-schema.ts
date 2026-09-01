// src/schemas/space/space-update-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const spaceUpdateParamsSchema = z.object({
  id: z.string().uuid('ID inválido, deve ser um UUID'),
})

// Tipagem para os parâmetros da URL
export type SpaceUpdateParamsInput = z.infer<typeof spaceUpdateParamsSchema>

// Schema para validar o corpo da requisição
export const spaceUpdateBodySchema = z.object({
  name: z
    .string({ required_error: 'O preenchimento do nome é obrigatório.' })
    .min(3, 'O nome do espaço deve ter pelo menos 3 caracteres')
    .max(100, 'O nome do espaço deve ter no máximo 100 caracteres')
    .optional(),
  description: z
    .string()
    .max(500, 'A descrição deve ter no máximo 500 caracteres')
    .nullable()
    .optional(),
  recursos: z.array(z.string()).optional(),
  imagens: z
    .array(z.string())
    .max(5, 'Você pode enviar no máximo 5 imagens')
    .optional(),
  capacidade: z
    .number({
      required_error: 'O preenchimento da capacidade é obrigatório.',
    })
    .int('A capacidade deve ser um número inteiro')
    .positive('A capacidade deve ser um número positivo')
    .optional(),
  type: z
    .enum(['room', 'workstation'])
    .optional()
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
  qrcodeUrl: z
    .string()
    .nullable()
    .optional()
    .describe('URL do QR Code do espaço'),
  isActive: z.boolean().optional(),
})

// Tipagem para o corpo da requisição
export type SpaceUpdateBodyInput = z.infer<typeof spaceUpdateBodySchema>

// Schema para validar a resposta
export const spaceUpdateResponseSchema = z
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
    }),
    message: z.string(),
  })
  .describe('Espaço atualizado com sucesso')
