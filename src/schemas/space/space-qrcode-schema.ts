// src/schemas/space/space-qrcode-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da URL
export const spaceQrcodeParamsSchema = z.object({
  spaceId: z
    .string()
    .uuid('ID inválido, deve ser um UUID')
    .describe(
      'Identificador único do espaço no formato UUID v4. Campo obrigatório.',
    ),
})

// Schema para validar a resposta
export const spaceQrcodeResponseSchema = z
  .object({
    qrcodeUrl: z
      .string()
      .describe('URL para o QR code gerado do espaço. Campo obrigatório.'),
    message: z
      .string()
      .describe(
        'Mensagem informativa sobre o resultado da operação. Campo obrigatório.',
      ),
  })
  .describe('QR code do espaço gerado com sucesso')

// Types inferidos
export type SpaceQrcodeParamsInput = z.infer<typeof spaceQrcodeParamsSchema>
export type SpaceQrcodeResponse = z.infer<typeof spaceQrcodeResponseSchema>
