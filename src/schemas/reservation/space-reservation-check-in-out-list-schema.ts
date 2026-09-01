import z from 'zod'

export const checkInOutListParamsSchema = z.object({
  spaceId: z
    .string({ required_error: 'ID do espaço é obrigatório' })
    .uuid('ID do espaço inválido, deve ser um UUID')
    .describe('Identificador único do espaço no formato UUID v4.'),
})

export type CheckInOutListParamsInput = z.input<
  typeof checkInOutListParamsSchema
>

const checkInOutRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string(),
  type: z.enum(['check-in', 'check-out']),
  createdAt: z.string().datetime(),
})

const reservationItemSchema = z.object({
  id: z.string().uuid(),
  slotStart: z.string(),
  slotEnd: z.string(),
  status: z.enum(['reserved', 'cancelled', 'closed']),
  isOwner: z.boolean(),
  checkInOuts: z.array(checkInOutRecordSchema),
})

export const checkInOutListResponseSchema = z.object({
  spaceName: z.string(),
  spaceType: z.enum(['room', 'workstation']),
  reservations: z.array(reservationItemSchema),
})

export type CheckInOutListResponse = z.infer<
  typeof checkInOutListResponseSchema
>
