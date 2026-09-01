// src/repositories/base/users-repository.ts

export interface UserDb {
  id: string
  email: string
  name: string | null
  nick_name: string | null
  email_verified: Date | null
  email_verified_provider: string | null
  avatar: string | null
  password_hash: string | null
  password_reset_required: boolean
  account_status: boolean
  role: 'dev' | 'admin' | 'user'
  created_at: Date
  updated_at: Date
  phone: string | null
  cpf: string | null
  warning_count: number
  booking_exception_until: Date | null
  absence_start_date: Date | null
  absence_end_date: Date | null
  absence_reason: string | null
}

export interface UserCreate {
  id?: string
  name?: string | null
  nickName?: string | null
  email: string
  emailVerified?: Date | null
  emailVerifiedProvider?: string | null
  avatar?: string | null
  passwordHash?: string
  passwordResetRequired?: boolean
  accountStatus?: boolean
  role?: 'dev' | 'admin' | 'user'
  phone?: string | null
  cpf?: string | null
}

export interface UserUpdate {
  id: string
  name?: string | null
  nickName?: string | null
  email?: string
  emailVerified?: Date | null
  emailVerifiedProvider?: string | null
  avatar?: string | null
  passwordHash?: string
  passwordResetRequired?: boolean
  accountStatus?: boolean
  role?: 'dev' | 'admin' | 'user'
  phone?: string | null
  cpf?: string | null
  warningCount?: number
  bookingExceptionUntil?: Date | null
}

export interface User {
  id: string
  name: string | null
  nickName: string | null
  email: string
  emailVerified: Date | null
  emailVerifiedProvider: string | null
  avatar: string | null
  passwordHash: string | null
  passwordResetRequired: boolean
  accountStatus: boolean
  role: 'dev' | 'admin' | 'user'
  createdAt: string
  updatedAt: string
  phone: string | null
  cpf: string | null
  warningCount: number
  bookingExceptionUntil: string | null
  absenceStartDate: string | null
  absenceEndDate: string | null
  absenceReason: string | null
}

export interface UserWithProvider {
  id: string
  name: string | null
  nickName: string | null
  email: string
  avatar: string | null
  provider: string
  emailVerified: Date | null
  emailVerifiedProvider: string | null
  passwordHash: string | null
  passwordResetRequired: boolean
  accountStatus: boolean
  role: 'dev' | 'admin' | 'user'
  phone: string | null
  cpf: string | null
  warningCount: number
  bookingExceptionUntil: string | null
  absenceStartDate: string | null
  absenceEndDate: string | null
  absenceReason: string | null
}

export interface UserFilters {
  searchTerm?: string
  role?: 'dev' | 'admin' | 'user'
  accountStatus?: boolean
}

export interface PaginatedUsers {
  users: User[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface UserAccountContext {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'dev'
  cpf: string | null
  accountStatus: boolean
}

/**
 * Interface que representa um usuário com sua posição na equipe.
 * Utilizada pelo middleware validateUserAccount para evitar 2 queries separadas.
 *
 * @optimization Reduz de 2 queries (findById + findByUserId) para 1 query com JOIN
 */
export interface UserWithTeamPosition extends User {
  teamPosition:
    | 'director'
    | 'supervisor'
    | 'manager'
    | 'assistant_manager'
    | 'assistant'
    | null
}

export interface IUserRepository {
  create(user: UserCreate): Promise<User>
  update(user: UserUpdate): Promise<User>
  deleteById(id: string): Promise<void>
  findById(id: string): Promise<User | null>
  /**
   * Busca usuário por ID incluindo sua posição na equipe (team_positions).
   * Faz um único SELECT com LEFT JOIN, evitando N+1 queries.
   *
   * @optimization Usado pelo middleware validateUserAccount para reduzir queries
   */
  findByIdWithTeamPosition(id: string): Promise<UserWithTeamPosition | null>
  findByCpf(cpf: string): Promise<User | null>
  findByEmailWithProvider(
    email: string,
    provider: string,
  ): Promise<UserWithProvider | null>
  findByIdWithProvider(
    id: string,
    provider: string,
  ): Promise<UserWithProvider | null>
  findByEmail(email: string): Promise<User | null>
  listUsers(
    filters?: UserFilters,
    page?: number,
    pageSize?: number,
  ): Promise<PaginatedUsers>

  /**
   * Define ou remove o período de afastamento de um usuário.
   * Para remover, passar startDate e endDate como null.
   */
  setAbsence(
    userId: string,
    startDate: string | null,
    endDate: string | null,
    reason?: string | null,
  ): Promise<User>

  /**
   * Lista usuários com afastamento definido.
   * @param includeExpired Se true, inclui afastamentos já expirados
   * @param supervisorPositionId ID da posição do supervisor para filtrar equipe (opcional)
   */
  listUsersWithAbsence(
    page: number,
    pageSize: number,
    includeExpired: boolean,
    supervisorPositionId?: string,
  ): Promise<{
    users: Array<{
      userId: string
      userName: string | null
      userEmail: string
      position:
        | 'director'
        | 'supervisor'
        | 'manager'
        | 'assistant_manager'
        | 'assistant'
        | null
      supervisorName: string | null
      absenceStartDate: string
      absenceEndDate: string
      absenceReason: string | null
      isActive: boolean
    }>
    total: number
  }>
}
