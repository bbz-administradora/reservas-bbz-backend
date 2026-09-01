// src/schemas/image/image-delete-schema.ts
import z from 'zod'

// Schema para validar o corpo da requisição para delete
export const imageDeleteBodySchema = z
  .object({
    imagePath: z
      .string({ message: 'Caminho da imagem é obrigatório' })
      .nonempty(),
  })
  .describe('Payload to delete an image')

// Schema para validar a resposta do delete
export const imageDeleteResponseSchema = z
  .object({
    message: z.string(),
  })
  .describe('Image deleted successfully')

// Tipagem para o corpo da requisição
export type ImageDeleteBodyInput = z.infer<typeof imageDeleteBodySchema>
