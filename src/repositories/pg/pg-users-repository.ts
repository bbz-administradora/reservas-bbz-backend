// src/repositories/pg/pg-users-repository.ts

import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  IUserRepository,
  PaginatedUsers,
  User,
  UserCreate,
  UserDb,
  UserFilters,
  UserUpdate,
  UserWithProvider,
  UserWithTeamPosition,
} from '../base/users-repository'

export class PgUsersRepository implements IUserRepository {
  async create(user: UserCreate): Promise<User> {
    if (!user.email) {
      throw new BadRequestError({
        message:
          'Email é obrigatório para criar o usuário no repositório pg-users-repository.',
        action: 'Forneça um email válido e tente novamente.',
      })
    }

    // 📌 Normaliza o email: remove espaços e converte para lowercase
    user.email = user.email.trim().toLowerCase()

    // Mapeia as colunas para snake_case
    const { columns, placeholders, values } = this.mapToDbColumns(user)

    if (columns.length === 0) {
      throw new BadRequestError({
        message:
          'Nenhum campo válido foi fornecido para criar o usuário no repositório pg-users-repository.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const queryText = `
      INSERT INTO users (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values,
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao criar o usuário no repositório pg-users-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToUser(result.rows[0])
  }

  async update(user: UserUpdate): Promise<User> {
    if (!user.id) {
      throw new BadRequestError({
        message:
          'O ID do usuário é obrigatório para atualizar o usuário no repositório pg-users-repository.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    // 📌 Normaliza o email se fornecido: remove espaços e converte para lowercase
    if (user.email) {
      user.email = user.email.trim().toLowerCase()
    }

    const { columns, placeholders, values } = this.mapToDbColumns(user, true)

    if (columns.length === 0) {
      throw new BadRequestError({
        message:
          'Nenhum campo válido foi fornecido para atualizar o usuário no repositório pg-users-repository.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    values.push(user.id)

    const queryText = `
      UPDATE users
      SET ${columns.join(', ')}, updated_at = now() at time zone 'utc'
      WHERE id = $${values.length}
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values,
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message:
          'Falha ao atualizar o usuário no repositório pg-users-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToUser(result.rows[0])
  }

  async findById(id: string): Promise<User | null> {
    const result = await database.query({
      text: `
        SELECT *
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      values: [id],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToUser(result.rows[0])
  }

  /**
   * Busca usuário por ID incluindo sua posição na equipe (team_positions).
   * Faz um único SELECT com LEFT JOIN, evitando 2 queries separadas.
   *
   * @optimization Reduz de 2 queries para 1 no middleware validateUserAccount
   */
  async findByIdWithTeamPosition(
    id: string,
  ): Promise<UserWithTeamPosition | null> {
    const result = await database.query({
      text: `
        SELECT
          u.*,
          tp.position AS team_position
        FROM users u
        LEFT JOIN team_positions tp ON tp.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      values: [id],
    })

    if (!result.rows[0]) {
      return null
    }

    const row = result.rows[0]
    return {
      ...this.mapToUser(row),
      teamPosition: row.team_position || null,
    }
  }

  async findByCpf(cpf: string): Promise<User | null> {
    if (!cpf) {
      throw new BadRequestError({
        message:
          'CPF é obrigatório para buscar o usuário no repositório pg-users-repository.',
        action: 'Forneça um CPF válido e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT *
        FROM users
        WHERE cpf = $1
        LIMIT 1
      `,
      values: [cpf],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToUser(result.rows[0])
  }

  async findByEmailWithProvider(
    email: string,
    provider: string,
  ): Promise<UserWithProvider | null> {
    // 📌 Normaliza o email antes de buscar: remove espaços e converte para lowercase
    const normalizedEmail = email.trim().toLowerCase()

    const result = await database.query({
      text: `
        SELECT
          u.id, u.name, u.nick_name, u.email, u.avatar, u.email_verified,
          u.email_verified_provider, u.password_hash, u.role, u.phone, u.cpf,
          u.password_reset_required, u.account_status, a.provider, u.warning_count,
          u.booking_exception_until, u.absence_start_date, u.absence_end_date, u.absence_reason
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id AND a.provider = $2
        WHERE u.email = $1
        LIMIT 1
      `,
      values: [normalizedEmail, provider],
    })

    if (!result.rows[0]) {
      return null
    }

    return {
      id: result.rows[0].id,
      name: result.rows[0].name,
      nickName: result.rows[0].nick_name,
      email: result.rows[0].email,
      avatar: result.rows[0].avatar,
      provider: result.rows[0].provider,
      emailVerified: result.rows[0].email_verified,
      emailVerifiedProvider: result.rows[0].email_verified_provider,
      passwordHash: result.rows[0].password_hash,
      passwordResetRequired: result.rows[0].password_reset_required,
      accountStatus: result.rows[0].account_status,
      role: result.rows[0].role,
      phone: result.rows[0].phone,
      cpf: result.rows[0].cpf,
      warningCount: result.rows[0].warning_count || 0,
      bookingExceptionUntil: result.rows[0].booking_exception_until
        ? result.rows[0].booking_exception_until.toISOString()
        : null,
      absenceStartDate: result.rows[0].absence_start_date
        ? result.rows[0].absence_start_date.toISOString().split('T')[0]
        : null,
      absenceEndDate: result.rows[0].absence_end_date
        ? result.rows[0].absence_end_date.toISOString().split('T')[0]
        : null,
      absenceReason: result.rows[0].absence_reason ?? null,
    }
  }

  async findByIdWithProvider(
    id: string,
    provider: string,
  ): Promise<UserWithProvider | null> {
    const result = await database.query({
      text: `
        SELECT
          u.id, u.name, u.nick_name, u.email, u.avatar, u.email_verified,
          u.email_verified_provider, u.password_hash, u.role, u.phone, u.cpf,
          u.password_reset_required, u.account_status, a.provider, u.warning_count,
          u.booking_exception_until, u.absence_start_date, u.absence_end_date, u.absence_reason
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id AND a.provider = $2
        WHERE u.id = $1
        LIMIT 1
      `,
      values: [id, provider],
    })

    if (!result.rows[0]) {
      return null
    }

    return {
      id: result.rows[0].id,
      name: result.rows[0].name,
      nickName: result.rows[0].nick_name,
      email: result.rows[0].email,
      avatar: result.rows[0].avatar,
      provider: result.rows[0].provider,
      emailVerified: result.rows[0].email_verified,
      emailVerifiedProvider: result.rows[0].email_verified_provider,
      passwordHash: result.rows[0].password_hash,
      passwordResetRequired: result.rows[0].password_reset_required,
      accountStatus: result.rows[0].account_status,
      role: result.rows[0].role,
      phone: result.rows[0].phone,
      cpf: result.rows[0].cpf,
      warningCount: result.rows[0].warning_count || 0,
      bookingExceptionUntil: result.rows[0].booking_exception_until
        ? result.rows[0].booking_exception_until.toISOString()
        : null,
      absenceStartDate: result.rows[0].absence_start_date
        ? result.rows[0].absence_start_date.toISOString().split('T')[0]
        : null,
      absenceEndDate: result.rows[0].absence_end_date
        ? result.rows[0].absence_end_date.toISOString().split('T')[0]
        : null,
      absenceReason: result.rows[0].absence_reason ?? null,
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!email) {
      throw new BadRequestError({
        message:
          'Email é obrigatório para buscar o usuário no repositório pg-users-repository.',
        action: 'Forneça um email válido e tente novamente.',
      })
    }

    // 📌 Normaliza o email antes de buscar: remove espaços e converte para lowercase
    const normalizedEmail = email.trim().toLowerCase()

    const result = await database.query({
      text: `
        SELECT *
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      values: [normalizedEmail],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToUser(result.rows[0])
  }

  async deleteById(id: string): Promise<void> {
    if (!id) {
      throw new BadRequestError({
        message:
          'O ID do usuário é obrigatório para deletar o usuário no repositório pg-users-repository.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    await database.query({
      text: `
        DELETE FROM users
        WHERE id = $1
      `,
      values: [id],
    })
  }

  async listUsers(
    filters: UserFilters = {},
    page = 1,
    pageSize = 1000,
  ): Promise<PaginatedUsers> {
    // build dynamic WHERE clauses
    const whereClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    // filter by name or email
    if (filters.searchTerm) {
      whereClauses.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`)
      values.push(`%${filters.searchTerm}%`)
      idx++
    }

    // filter by single role
    if (filters.role) {
      whereClauses.push(`u.role = $${idx}`)
      values.push(filters.role)
      idx++
    }

    // filter by account status
    if (filters.accountStatus !== undefined) {
      whereClauses.push(`u.account_status = $${idx}`)
      values.push(filters.accountStatus)
      idx++
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(' AND ')}`
      : ''

    // pagination
    const offset = (page - 1) * pageSize
    values.push(pageSize, offset)

    const queryText = `
      SELECT
        u.id,
        u.name,
        u.nick_name,
        u.email,
        u.avatar,
        u.role,
        u.account_status,
        u.password_reset_required,
        u.phone,
        u.cpf,
        u.created_at,
        u.updated_at,
        COUNT(*) OVER() AS total_count
      FROM users u
      ${whereSql}
      ORDER BY u.name ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `

    const result = await database.query({ text: queryText, values })
    const rows = result.rows as Array<UserDb & { total_count: string }>

    const totalCount = rows.length ? parseInt(rows[0].total_count, 10) : 0
    const totalPages = Math.ceil(totalCount / pageSize)

    const users: User[] = rows.map((row) => this.mapToUser(row))

    return {
      users,
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  private mapToDbColumns(data: Partial<UserCreate>, isUpdate = false) {
    const fields = Object.entries(data).filter(
      ([, value]) => value !== undefined,
    )
    const columns = fields.map(([key], index) =>
      isUpdate
        ? `${this.toSnakeCase(key)} = $${index + 1}`
        : this.toSnakeCase(key),
    )
    const placeholders = fields.map((_, index) => `$${index + 1}`)
    const values = fields.map(([, value]) => value)

    return { columns, placeholders, values }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  private mapToUser(row: UserDb): User {
    return {
      id: row.id,
      name: row.name,
      nickName: row.nick_name,
      email: row.email,
      emailVerified: row.email_verified,
      emailVerifiedProvider: row.email_verified_provider,
      avatar: row.avatar,
      passwordHash: row.password_hash,
      passwordResetRequired: row.password_reset_required,
      accountStatus: row.account_status,
      role: row.role,
      phone: row.phone,
      cpf: row.cpf,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      warningCount: row.warning_count || 0,
      bookingExceptionUntil: row.booking_exception_until
        ? row.booking_exception_until.toISOString()
        : null,
      absenceStartDate: row.absence_start_date
        ? row.absence_start_date.toISOString().split('T')[0]
        : null,
      absenceEndDate: row.absence_end_date
        ? row.absence_end_date.toISOString().split('T')[0]
        : null,
      absenceReason: row.absence_reason ?? null,
    }
  }

  /**
   * Define ou remove o período de afastamento de um usuário.
   * Para remover, passar startDate e endDate como null.
   */
  async setAbsence(
    userId: string,
    startDate: string | null,
    endDate: string | null,
    reason?: string | null,
  ): Promise<User> {
    const result = await database.query({
      text: `
        UPDATE users
        SET
          absence_start_date = $2,
          absence_end_date = $3,
          absence_reason = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      values: [userId, startDate, endDate, reason ?? null],
    })

    if (result.rowCount === 0) {
      throw new Error(`Usuário com ID ${userId} não encontrado.`)
    }

    return this.mapToUser(result.rows[0])
  }

  /**
   * Lista usuários com afastamento definido.
   * @param page Página atual
   * @param pageSize Itens por página
   * @param includeExpired Se true, inclui afastamentos já expirados
   * @param supervisorPositionId ID da posição do supervisor para filtrar equipe (opcional)
   */
  async listUsersWithAbsence(
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
  }> {
    const offset = (page - 1) * pageSize
    const values: any[] = []
    let paramIndex = 1

    // CTE recursiva para buscar subordinados do supervisor
    const subordinatesCTE = supervisorPositionId
      ? `
      WITH RECURSIVE subordinates AS (
        SELECT tms.subordinate_id
        FROM team_member_supervisors tms
        WHERE tms.supervisor_id = $${paramIndex++}

        UNION ALL

        SELECT tms.subordinate_id
        FROM team_member_supervisors tms
        INNER JOIN subordinates s ON tms.supervisor_id = s.subordinate_id
      )
      `
      : ''

    if (supervisorPositionId) {
      values.push(supervisorPositionId)
    }

    // CTE para encontrar supervisor real (precisa de RECURSIVE para auto-referência)
    const supervisorCTE = `
      ${supervisorPositionId ? ',' : 'WITH RECURSIVE'} hierarchy_chain AS (
        SELECT
          tms.subordinate_id AS original_position_id,
          tms.supervisor_id AS current_position_id,
          tp_sup.position AS current_position,
          tp_sup.user_id AS current_user_id,
          1 AS level
        FROM team_member_supervisors tms
        JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id

        UNION ALL

        SELECT
          hc.original_position_id,
          tms.supervisor_id AS current_position_id,
          tp_sup.position AS current_position,
          tp_sup.user_id AS current_user_id,
          hc.level + 1
        FROM hierarchy_chain hc
        JOIN team_member_supervisors tms ON tms.subordinate_id = hc.current_position_id
        JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id
        WHERE hc.current_position != 'supervisor'
      ),
      real_supervisors AS (
        SELECT DISTINCT ON (hc.original_position_id)
          hc.original_position_id,
          hc.current_user_id AS supervisor_user_id
        FROM hierarchy_chain hc
        WHERE hc.current_position = 'supervisor'
        ORDER BY hc.original_position_id, hc.level ASC
      )
    `

    // Condição de filtro de afastamentos
    const absenceCondition = includeExpired
      ? 'u.absence_start_date IS NOT NULL AND u.absence_end_date IS NOT NULL'
      : `u.absence_start_date IS NOT NULL
         AND u.absence_end_date IS NOT NULL
         AND u.absence_end_date >= CURRENT_DATE`

    // Condição de filtro por equipe do supervisor
    const teamCondition = supervisorPositionId
      ? 'AND tp.id IN (SELECT subordinate_id FROM subordinates)'
      : ''

    const queryText = `
      ${subordinatesCTE}
      ${supervisorCTE}
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        tp.position,
        sup_user.name AS supervisor_name,
        u.absence_start_date,
        u.absence_end_date,
        u.absence_reason,
        CASE
          WHEN CURRENT_DATE BETWEEN u.absence_start_date AND u.absence_end_date
          THEN true
          ELSE false
        END AS is_active,
        COUNT(*) OVER() AS total_count
      FROM users u
      LEFT JOIN team_positions tp ON tp.user_id = u.id
      LEFT JOIN real_supervisors rs ON rs.original_position_id = tp.id
      LEFT JOIN users sup_user ON sup_user.id = rs.supervisor_user_id
      WHERE ${absenceCondition}
      ${teamCondition}
      ORDER BY u.absence_end_date DESC, u.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    values.push(pageSize, offset)

    const result = await database.query({
      text: queryText,
      values,
    })

    const rows = result.rows as Array<{
      user_id: string
      user_name: string | null
      user_email: string
      position:
        | 'director'
        | 'supervisor'
        | 'manager'
        | 'assistant_manager'
        | 'assistant'
        | null
      supervisor_name: string | null
      absence_start_date: Date
      absence_end_date: Date
      absence_reason: string | null
      is_active: boolean
      total_count: string
    }>

    const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0

    return {
      users: rows.map((row) => ({
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        position: row.position,
        supervisorName: row.supervisor_name,
        absenceStartDate: row.absence_start_date.toISOString().split('T')[0],
        absenceEndDate: row.absence_end_date.toISOString().split('T')[0],
        absenceReason: row.absence_reason,
        isActive: row.is_active,
      })),
      total,
    }
  }
}
