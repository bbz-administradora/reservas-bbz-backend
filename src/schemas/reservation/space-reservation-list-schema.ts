import z from 'zod'

// Schema para check-in/check-out
export const spaceCheckInOutSchema = z.object({
  id: z
    .string()
    .uuid()
    .describe('Identificador único do registro de check-in/check-out'),
  spaceId: z.string().uuid().describe('Identificador único do espaço'),
  userId: z.string().uuid().describe('Identificador único do usuário'),
  userName: z.string().describe('Nome do usuário que fez o check-in/check-out'),
  reservationId: z.string().uuid().describe('Identificador único da reserva'),
  type: z
    .enum(['check-in', 'check-out'])
    .describe('Tipo do registro (check-in ou check-out)'),
  createdAt: z.string().datetime().describe('Data/hora do registro'),
})

// Querystring: paginação e filtros opcionais
export const spaceReservationListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .describe('Número da página para paginação, começando em 1 (padrão: 1)'),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10000))
    .describe(
      'Quantidade de resultados por página, entre 1 e 10000 (padrão: 10000)',
    ),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do usuário para filtrar reservas (opcional)'),
  spaceId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do espaço para filtrar reservas (opcional)'),
  includeUserAsGuest: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true')
    .describe(
      'Inclui reservas onde o usuário é convidado (email em bbz_collaborators ou external_guests)',
    ),
  startDate: z
    .string()
    .optional()
    .describe(
      'Data de início para filtrar reservas (formato ISO 8601, ex: 2024-01-01)',
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      'Data de fim para filtrar reservas (formato ISO 8601, ex: 2024-01-31)',
    ),
  teamOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true')
    .describe(
      'Se true, retorna apenas reservas dos subordinados do usuário autenticado (para supervisores)',
    ),
})

export type SpaceReservationListQueryInput = z.infer<
  typeof spaceReservationListQuerySchema
>

// ReservationDetail schema (detalhado para reuso)
export const reservationDetailSchema = z
  .object({
    id: z.string().uuid().describe('Identificador único da reserva'),
    space: z
      .object({
        id: z.string().uuid().describe('Identificador único do espaço'),
        name: z.string().describe('Nome do espaço'),
        type: z.enum(['room', 'workstation']).describe('Tipo do espaço'),
        floor: z.string().nullable().describe('Andar do espaço'),
        zone: z.string().nullable().describe('Zona do espaço'),
        position: z.string().nullable().describe('Posição do espaço'),
      })
      .describe('Informações básicas do espaço'),
    spaceSlotIds: z
      .array(z.string().uuid())
      .describe(
        'Array de identificadores únicos dos slots de tempo reservados',
      ),
    user: z
      .object({
        id: z.string().uuid().describe('Identificador único do usuário'),
        name: z.string().describe('Nome do usuário'),
        email: z.string().email().describe('E-mail do usuário'),
      })
      .describe('Informações do usuário que fez a reserva'),
    slotStart: z
      .string()
      .datetime({
        offset: true,
        message: 'Formato de data/hora inválido',
      })
      .describe(
        'Horário de início do slot no formato ISO com timezone do usuário',
      ),
    slotEnd: z
      .string()
      .datetime({
        offset: true,
        message: 'Formato de data/hora inválido',
      })
      .describe(
        'Horário de término do slot no formato ISO com timezone do usuário',
      ),
    bbzCollaborators: z
      .array(z.string())
      .describe('Lista de colaboradores da BBZ participantes'),
    externalGuests: z
      .array(z.string())
      .describe('Lista de convidados externos participantes'),
    needsCopeira: z
      .boolean()
      .describe('Indica se a reserva necessita de serviço de copeira'),
    status: z
      .enum(['reserved', 'cancelled', 'closed'])
      .describe('Status atual da reserva'),
    cancelledBy: z
      .object({
        id: z.string().uuid().describe('ID do usuário que cancelou'),
        name: z.string().describe('Nome do usuário que cancelou'),
      })
      .nullable()
      .describe('Usuário que cancelou a reserva (ou null)'),
    cancelReason: z
      .string()
      .nullable()
      .describe('Motivo do cancelamento (ou null)'),
    cancelledAt: z
      .string()
      .nullable()
      .describe('Data/hora do cancelamento (ou null)'),
    closedAt: z
      .string()
      .nullable()
      .describe('Data/hora do fechamento da reserva (ou null)'),
    createdAt: z.string().describe('Data/hora de criação da reserva'),
    checkInOuts: z
      .array(spaceCheckInOutSchema)
      .describe('Registros de check-in/check-out relacionados à reserva'),
  })
  .describe('Detalhes completos de uma reserva paginada')

// PaginatedReservations response
export const spaceReservationListResponseSchema = z
  .object({
    reservations: z
      .array(reservationDetailSchema)
      .describe('Lista de reservas encontradas na página atual'),
    totalCount: z
      .number()
      .describe('Número total de reservas encontradas para o filtro'),
    totalPages: z.number().describe('Número total de páginas disponíveis'),
    currentPage: z.number().describe('Número da página atual'),
  })
  .describe('Resposta paginada contendo reservas de espaço')

export type SpaceReservationListResponse = z.infer<
  typeof spaceReservationListResponseSchema
>
