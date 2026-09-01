// src/schemas/image/image-upload-schema.ts
import z from 'zod'

// Schema para validar os parâmetros de consulta para upload
export const imageUploadQuerySchema = z.object({
  group: z
    .string({ message: 'Enviar o grupo da imagem' })
    .nonempty()
    .describe("Group of asset. Ex: 'avatar', 'logo', 'product'"),
  subtitle: z
    .string()
    .optional()
    .describe("Subtitle of asset. Ex: 'profile', 'og', 'drink'"),
  folder: z
    .string()
    .optional()
    .describe('Custom folder to store the image. Default: userId'),
})

// Schema para validar a resposta do upload
export const imageUploadResponseSchema = z
  .object({
    imagePath: z.string(),
    message: z.string(),
  })
  .describe('Image uploaded successfully')

// Tipagem para os parâmetros de consulta
export type ImageUploadQueryInput = z.infer<typeof imageUploadQuerySchema>
