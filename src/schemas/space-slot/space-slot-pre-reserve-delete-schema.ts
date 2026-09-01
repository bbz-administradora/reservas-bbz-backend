//src/schemas/space-slot/space-slot-pre-reserve-delete-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da rota
export const spaceSlotPreReserveDeleteParamsSchema = z.object({
  slotId: z
    .string({
      required_error: 'ID do slot é obrigatório',
    })
    .uuid('ID do slot inválido, deve ser um UUID')
    .describe('Identificador único do slot a ser deletado'),
})

// Tipagem para os parâmetros da rota
export type SpaceSlotPreReserveDeletarParamsInput = z.infer<
  typeof spaceSlotPreReserveDeleteParamsSchema
>

// Schema para validar a resposta
export const spaceSlotPreReserveDeleteResponseSchema = z.object({
  message: z.string().describe('Mensagem de sucesso'),
  slotId: z.string().uuid().describe('Identificador do slot deletado'),
})

// Tipagem para a resposta
export type SpaceSlotPreReserveDeleteResponse = z.infer<
  typeof spaceSlotPreReserveDeleteResponseSchema
>
