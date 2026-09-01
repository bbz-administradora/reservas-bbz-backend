// src/repositories/base/space-check-in-out-repository.ts

// Status possíveis para ocorrências de checkout antecipado
export type EarlyCheckoutStatus = 'pending' | 'justified' | 'dismissed'

export interface SpaceCheckInOutDb {
  id: string
  space_id: string
  user_id: string
  reservation_id: string
  type: 'check-in' | 'check-out'
  created_at: Date
  // Campos de checkout antecipado (apenas para check-out em workstations)
  is_early_checkout: boolean | null
  early_checkout_status: EarlyCheckoutStatus | null
  worked_hours: number | null
  justification: string | null
  justified_by: string | null
  justified_at: Date | null
}

export interface SpaceCheckInOutCreate {
  spaceId: string
  userId: string
  reservationId: string
  type: 'check-in' | 'check-out'
  // Campos de checkout antecipado (opcionais, usados apenas no check-out de workstations)
  isEarlyCheckout?: boolean
  earlyCheckoutStatus?: EarlyCheckoutStatus
  workedHours?: number
}

export interface SpaceCheckInOutUpdate {
  id: string
  spaceId?: string
  userId?: string
  reservationId?: string
  type?: 'check-in' | 'check-out'
  createdAt?: Date
  // Campos de checkout antecipado
  isEarlyCheckout?: boolean
  earlyCheckoutStatus?: EarlyCheckoutStatus
  workedHours?: number
  justification?: string
  justifiedBy?: string
  justifiedAt?: Date
}

export interface SpaceCheckInOut {
  id: string
  spaceId: string
  userId: string
  reservationId: string
  type: 'check-in' | 'check-out'
  createdAt: string
  userName: string
  // Campos de checkout antecipado
  isEarlyCheckout: boolean | null
  earlyCheckoutStatus: EarlyCheckoutStatus | null
  workedHours: number | null
  justification: string | null
  justifiedBy: string | null
  justifiedAt: string | null
}

export interface ISpaceCheckInOutRepository {
  create(input: SpaceCheckInOutCreate): Promise<SpaceCheckInOut>
  update(input: SpaceCheckInOutUpdate): Promise<SpaceCheckInOut>
  delete(id: string): Promise<void>

  /**
   * Busca registros de check-in/check-out para uma reserva específica
   */
  findByReservationId(reservationId: string): Promise<SpaceCheckInOut[]>

  /**
   * Busca registros de check-in/check-out para um usuário e espaço específicos
   */
  findByUserAndSpace(
    userId: string,
    spaceId: string,
  ): Promise<SpaceCheckInOut[]>

  /**
   * Busca registros de check-in/check-out para uma reserva, usuário e espaço específicos
   */
  findByReservationUserAndSpace(
    reservationId: string,
    userId: string,
    spaceId: string,
  ): Promise<SpaceCheckInOut[]>

  /**
   * Busca apenas registros de check-in para uma reserva específica
   */
  findCheckInByReservationId(reservationId: string): Promise<SpaceCheckInOut[]>

  // ========================================
  // 📌 MÉTODOS PARA EARLY CHECKOUT
  // ========================================

  /**
   * Busca os IDs dos usuários da equipe de um supervisor
   * @param supervisorUserId ID do usuário supervisor
   */
  getTeamUserIdsBySupervisor(supervisorUserId: string): Promise<string[]>

  /**
   * Busca indicadores de early checkout (totais por status)
   */
  getEarlyCheckoutIndicators(filters: EarlyCheckoutFilters): Promise<{
    total: number
    pending: number
    justified: number
    dismissed: number
  }>

  /**
   * Busca a data da ocorrência pendente mais antiga
   */
  getOldestPendingEarlyCheckoutDate(
    teamUserIds?: string[],
  ): Promise<Date | null>

  /**
   * Lista ocorrências de early checkout com paginação
   */
  listEarlyCheckoutOccurrences(
    filters: EarlyCheckoutFilters & { page: number; pageSize: number },
  ): Promise<{
    occurrences: EarlyCheckoutOccurrence[]
    totalItems: number
  }>

  /**
   * Busca uma ocorrência de early checkout por ID
   */
  findEarlyCheckoutById(id: string): Promise<EarlyCheckoutOccurrence | null>

  /**
   * Atualiza a justificativa de uma ocorrência de early checkout
   */
  justifyEarlyCheckout(input: {
    id: string
    status: EarlyCheckoutStatus
    justification: string | null
    justifiedBy: string
  }): Promise<void>
}

// ========================================
// 📌 TIPOS PARA EARLY CHECKOUT
// ========================================

export interface EarlyCheckoutFilters {
  status?: EarlyCheckoutStatus | 'all'
  supervisorName?: string
  userName?: string
  userEmail?: string
  position?: 'manager' | 'assistant_manager' | 'assistant'
  teamUserIds?: string[]
}

export interface EarlyCheckoutOccurrence {
  id: string
  userId: string
  userName: string | null
  userEmail: string
  userAvatar: string | null
  position:
    | 'director'
    | 'supervisor'
    | 'manager'
    | 'assistant_manager'
    | 'assistant'
    | null
  supervisorId: string | null
  supervisorName: string | null
  supervisorEmail: string | null
  checkInAt: string
  checkOutAt: string
  workedHours: number
  status: EarlyCheckoutStatus
  justification: string | null
  justifiedByName: string | null
  justifiedAt: string | null
  spaceId: string
  spaceName: string
  reservationId: string
}
