// src/schemas/team/team-members-schema.ts
import z from 'zod'

// Schema para validar a resposta
export const teamMembersResponseSchema = z
  .object({
    members: z.array(
      z.object({
        userId: z.string().uuid().describe('ID do usuário'),
        name: z.string().nullable().describe('Nome do usuário'),
        email: z.string().email().describe('Email do usuário'),
        position: z
          .enum([
            'director',
            'supervisor',
            'manager',
            'assistant_manager',
            'assistant',
          ])
          .describe('Posição na hierarquia'),
        bookingExceptionUntil: z
          .string()
          .nullable()
          .describe('Data/hora limite da exceção. NULL se não há exceção.'),
      }),
    ),
    total: z.number().describe('Total de membros'),
    message: z.string().describe('Mensagem informativa'),
  })
  .describe('Lista de membros da equipe')

// Type inferido
export type TeamMembersResponse = z.infer<typeof teamMembersResponseSchema>
