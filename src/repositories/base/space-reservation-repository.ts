// src/repositories/base/space-reservation-repository.ts
import { SpaceCheckInOut } from './space-check-in-out-repository'

export interface SpaceReservationDb {
  id: string
  space_id: string
  user_id: string
  space_slot_ids: string[] // Array JSONB de IDs dos slots
  bbz_collaborators: string[] // Array de colaboradores internos (formato JSON)
  external_guests: string[] // Array de convidados externos (formato JSON)
  needs_copeira: boolean
  status: 'reserved' | 'cancelled' | 'closed'
  cancelled_by: string | null
  cancel_reason: string | null
  cancelled_at: Date | null
  closed_at: Date | null
  created_at: Date
  updated_at: Date
  slot_range: [Date, Date] // snapshot do horário da reserva [início, fim]
  attendance_status:
    'pending' | 'checked-in' | 'checked-out' | 'absent' | 'not-applicable'
  email_notification_status:
    'not-evaluated' | 'pending' | 'sent' | 'not-required' | 'error'
}

export interface SpaceReservationCreate {
  spaceId: string
  userId: string
  spaceSlotIds: string[] // Array de IDs dos slots de tempo
  bbzCollaborators?: string[]
  externalGuests?: string[]
  needsCopeira?: boolean
  slotRange: [string, string] // [start, end] ISO strings
}

export interface SpaceReservation {
  id: string
  spaceId: string
  userId: string
  spaceSlotIds: string[] // Array de IDs dos slots
  bbzCollaborators: string[]
  externalGuests: string[]
  needsCopeira: boolean
  status: 'reserved' | 'cancelled' | 'closed'
  cancelledBy: string | null
  cancelReason: string | null
  cancelledAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  slotRange: [string, string] // [start, end] ISO strings
  attendanceStatus:
    'pending' | 'checked-in' | 'checked-out' | 'absent' | 'not-applicable'
  emailNotificationStatus:
    'not-evaluated' | 'pending' | 'sent' | 'not-required' | 'error'
}

export interface ReservationUser {
  id: string
  name: string
  email: string
}

export interface ReservationSpaceBasic {
  id: string
  name: string
  type: 'room' | 'workstation'
  floor: string | null
  zone: string | null
  position: string | null
}

export interface ReservationCancellerBasic {
  id: string
  name: string
}

export interface ReservationDetail {
  id: string
  space: ReservationSpaceBasic
  spaceSlotIds: string[] // Array de IDs dos slots
  user: ReservationUser
  bbzCollaborators: string[]
  externalGuests: string[]
  needsCopeira: boolean
  status: 'reserved' | 'cancelled' | 'closed'
  cancelledBy: ReservationCancellerBasic | null
  cancelReason: string | null
  cancelledAt: string | null
  closedAt: string | null
  createdAt: string
  slotRange: [string, string] // [start, end] ISO strings (snapshot, sempre presente)
  checkInOuts: SpaceCheckInOut[] // Registros de check-in/check-out relacionados à reserva
  attendanceStatus:
    'pending' | 'checked-in' | 'checked-out' | 'absent' | 'not-applicable'
  emailNotificationStatus:
    'not-evaluated' | 'pending' | 'sent' | 'not-required' | 'error'
}

export interface PaginatedReservations {
  reservations: ReservationDetail[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface SpaceReservationStats {
  total: number
  nextReservation: string | null
  mostUsedStartTimes: string[]
}

export interface ISpaceReservationRepository {
  create(input: SpaceReservationCreate): Promise<SpaceReservation>
  findById(id: string): Promise<SpaceReservation | null>
  /**
   * Busca uma reserva que contenha os IDs de slots no array spaceSlotIds
   */
  findBySpaceSlotIds(spaceSlotIds: string[]): Promise<SpaceReservation | null>
  cancelReservation(
    id: string,
    cancelledBy: string,
    cancelReason: string,
  ): Promise<SpaceReservation>
  closeReservation(id: string, userId: string): Promise<SpaceReservation>

  /**
   * Busca uma reserva pelo ID e retorna com detalhes (espaço, usuário e cancelador)
   *
   * @param id ID da reserva a ser buscada
   * @returns Detalhes completos da reserva ou null se não encontrada
   */
  getReservationDetailById(id: string): Promise<ReservationDetail | null>

  /**
   * Lista reservas com paginação e filtros opcionais
   *
   * @param page Número da página (começa em 1)
   * @param pageSize Tamanho da página (registros por página)
   * @param filters Filtros opcionais para a consulta
   * @returns Objeto paginado contendo array de ReservationDetail e metadados
   *
   * Nota:
   * - Se nenhum filtro for fornecido, retorna todas as reservas
   * - Se userId for fornecido e includeUserAsGuest=true, também retorna reservas
   *   onde o usuário é convidado (email está em bbz_collaborators ou external_guests)
   * - Se userIds for fornecido, filtra apenas reservas desses usuários (para filtro de equipe)
   */
  listReservations(
    page?: number,
    pageSize?: number,
    filters?: {
      spaceId?: string
      userId?: string
      status?: 'reserved' | 'cancelled' | 'closed'
      startDate?: string
      endDate?: string
      includeUserAsGuest?: boolean
      userEmail?: string
      userIds?: string[]
    },
  ): Promise<PaginatedReservations>

  getUserReservationStats(userId: string): Promise<SpaceReservationStats>

  /**
   * Conta quantos dias distintos o usuário tem reservas de workstations em um período
   *
   * @param userId ID do usuário
   * @param startDate Data de início do período
   * @param endDate Data de fim do período
   * @returns Número de dias distintos com reservas de workstations
   */
  countUserWorkstationDaysByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>

  /**
   * Lista usuários que não cumpriram a exigência de reservas semanais
   *
   * @param startDate Data de início da semana
   * @param endDate Data de fim da semana
   * @param supervisorPositionId ID da posição do supervisor (opcional - filtra por equipe)
   * @param isCurrentWeek Se true, conta também reservas com status 'closed' e attendance 'checked-out'
   * @returns Lista de usuários não-compliant com seus dados
   */
  listNonCompliantUsers(
    startDate: Date,
    endDate: Date,
    supervisorPositionId?: string,
    isCurrentWeek?: boolean,
  ): Promise<NonCompliantUser[]>

  /**
   * Conta reservas de workstation encerradas após o prazo de planejamento
   *
   * Uma reserva é considerada "cancelada após prazo" quando:
   * - O espaço é do tipo 'workstation'
   * - A reserva foi encerrada (status = 'closed')
   * - O encerramento (closed_at) ocorreu após a quinta-feira da semana anterior à reserva
   *
   * @param filters Filtros opcionais (período, equipe do supervisor)
   * @returns Número total de cancelamentos após prazo
   */
  countCancelledReservations(
    filters?: CancelledReservationsFilters,
  ): Promise<number>

  /**
   * Lista reservas de workstation encerradas após o prazo de planejamento
   *
   * Uma reserva é considerada "cancelada após prazo" quando:
   * - O espaço é do tipo 'workstation'
   * - A reserva foi encerrada (status = 'closed')
   * - O encerramento (closed_at) ocorreu após a quinta-feira da semana anterior à reserva
   *
   * @param page Número da página (começa em 1)
   * @param pageSize Tamanho da página
   * @param filters Filtros opcionais (período, nome, cargo, equipe)
   * @returns Lista paginada de cancelamentos
   */
  listCancelledReservations(
    page?: number,
    pageSize?: number,
    filters?: CancelledReservationsFilters,
  ): Promise<PaginatedCancelledReservations>
}

/**
 * Interface para representar um usuário não-compliant
 */
export interface NonCompliantUser {
  userId: string
  userName: string | null
  userEmail: string
  position: string
  supervisorName: string | null
  requiredDays: number
  reservedDays: number
  isCompliant: boolean
}

/**
 * Interface para representar um cancelamento de reserva após o prazo de planejamento
 */
export interface CancelledReservation {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPosition: string | null
  supervisorId: string | null
  supervisorName: string | null
  supervisorEmail: string | null
  spaceId: string
  spaceName: string
  slotStart: string
  slotEnd: string
  closedAt: string
  planningDeadline: string // quinta-feira da semana anterior à reserva
}

/**
 * Interface para filtros de busca de cancelamentos
 */
export interface CancelledReservationsFilters {
  startDate?: string // data inicial do período de busca (baseado em closed_at)
  endDate?: string // data final do período de busca (baseado em closed_at)
  userName?: string // filtro por nome do colaborador (ILIKE)
  supervisorName?: string // filtro por nome do supervisor (ILIKE)
  position?: string // filtro por cargo
  supervisorPositionId?: string // filtro por equipe do supervisor (mostra apenas subordinados)
}

/**
 * Interface para resposta paginada de cancelamentos
 */
export interface PaginatedCancelledReservations {
  reservations: CancelledReservation[]
  totalCount: number
  totalPages: number
  currentPage: number
}
