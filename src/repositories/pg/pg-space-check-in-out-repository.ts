// src/repositories/pg/pg-space-check-in-out-repository.ts
import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  EarlyCheckoutFilters,
  EarlyCheckoutOccurrence,
  EarlyCheckoutStatus,
  ISpaceCheckInOutRepository,
  SpaceCheckInOut,
  SpaceCheckInOutCreate,
  SpaceCheckInOutUpdate,
} from '../base/space-check-in-out-repository'

export class PgSpaceCheckInOutRepository implements ISpaceCheckInOutRepository {
  async create(input: SpaceCheckInOutCreate): Promise<SpaceCheckInOut> {
    if (
      !input.spaceId ||
      !input.userId ||
      !input.reservationId ||
      !input.type
    ) {
      throw new BadRequestError({
        message: 'Dados incompletos para registrar check-in/check-out',
        action: 'Forneça spaceId, userId, reservationId e type válidos',
      })
    }

    const query = {
      text: `
        INSERT INTO space_check_in_out (
          space_id,
          user_id,
          reservation_id,
          type,
          is_early_checkout,
          early_checkout_status,
          worked_hours
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        ) RETURNING
          id,
          space_id,
          user_id,
          reservation_id,
          type,
          created_at,
          is_early_checkout,
          early_checkout_status,
          worked_hours,
          justification,
          justified_by,
          justified_at
      `,
      values: [
        input.spaceId,
        input.userId,
        input.reservationId,
        input.type,
        input.isEarlyCheckout ?? null,
        input.earlyCheckoutStatus ?? null,
        input.workedHours ?? null,
      ],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao registrar check-in/check-out',
        action: 'Verifique os dados e tente novamente',
      })
    }

    // Busca o nome do usuário após o insert
    const userName = await this.getUserNameById(input.userId)
    const row = result.rows[0]

    return {
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      reservationId: row.reservation_id,
      type: row.type,
      createdAt: row.created_at.toISOString(),
      userName,
      isEarlyCheckout: row.is_early_checkout,
      earlyCheckoutStatus: row.early_checkout_status,
      workedHours: row.worked_hours ? parseFloat(row.worked_hours) : null,
      justification: row.justification,
      justifiedBy: row.justified_by,
      justifiedAt: row.justified_at ? row.justified_at.toISOString() : null,
    }
  }

  async update(input: SpaceCheckInOutUpdate): Promise<SpaceCheckInOut> {
    if (!input.id) {
      throw new BadRequestError({
        message: 'ID é obrigatório para atualizar o registro',
        action: 'Forneça um ID válido',
      })
    }

    // Cria os componentes da query dinâmica baseado nos campos fornecidos
    const { columns, values, placeholders } = this.mapToDbColumns(input, true)

    if (columns.length === 0) {
      throw new BadRequestError({
        message: 'Nenhum campo válido foi fornecido para atualização',
        action: 'Forneça ao menos um campo para atualizar',
      })
    }

    // Adiciona o ID ao final dos valores para a cláusula WHERE
    values.push(input.id)

    const queryText = `
      UPDATE space_check_in_out
      SET ${columns.join(', ')}
      WHERE id = $${values.length}
      RETURNING
        id,
        space_id,
        user_id,
        reservation_id,
        type,
        created_at,
        is_early_checkout,
        early_checkout_status,
        worked_hours,
        justification,
        justified_by,
        justified_at
    `

    const result = await database.query({
      text: queryText,
      values,
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao atualizar check-in/check-out',
        action: 'Verifique os dados e tente novamente',
      })
    }

    // Busca o nome do usuário após o update
    const userName = await this.getUserNameById(result.rows[0].user_id)
    const row = result.rows[0]

    return {
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      reservationId: row.reservation_id,
      type: row.type,
      createdAt: row.created_at.toISOString(),
      userName,
      isEarlyCheckout: row.is_early_checkout,
      earlyCheckoutStatus: row.early_checkout_status,
      workedHours: row.worked_hours ? parseFloat(row.worked_hours) : null,
      justification: row.justification,
      justifiedBy: row.justified_by,
      justifiedAt: row.justified_at ? row.justified_at.toISOString() : null,
    }
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new BadRequestError({
        message: 'ID é obrigatório para deletar o registro',
        action: 'Forneça um ID válido',
      })
    }

    await database.query({
      text: `
        DELETE FROM space_check_in_out
        WHERE id = $1
      `,
      values: [id],
    })
  }

  /**
   * Busca registros de check-in/check-out para uma reserva específica
   *
   * @param reservationId ID da reserva
   * @returns Array de registros de check-in/check-out
   */
  async findByReservationId(reservationId: string): Promise<SpaceCheckInOut[]> {
    if (!reservationId) {
      throw new BadRequestError({
        message: 'ID da reserva é obrigatório',
        action: 'Forneça um ID de reserva válido',
      })
    }

    const query = {
      text: `
        SELECT
          sci.id,
          sci.space_id,
          sci.user_id,
          sci.reservation_id,
          sci.type,
          sci.created_at,
          sci.is_early_checkout,
          sci.early_checkout_status,
          sci.worked_hours,
          sci.justification,
          sci.justified_by,
          sci.justified_at,
          u.name as user_name
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        WHERE sci.reservation_id = $1
        ORDER BY sci.created_at ASC
      `,
      values: [reservationId],
    }

    const result = await database.query(query)
    return result.rows.map(this.mapToSpaceCheckInOutWithUserName)
  }

  /**
   * Busca registros de check-in/check-out para um usuário e espaço específicos
   *
   * @param userId ID do usuário
   * @param spaceId ID do espaço
   * @returns Array de registros de check-in/check-out
   */
  async findByUserAndSpace(
    userId: string,
    spaceId: string,
  ): Promise<SpaceCheckInOut[]> {
    if (!userId || !spaceId) {
      throw new BadRequestError({
        message: 'ID do usuário e ID do espaço são obrigatórios',
        action: 'Forneça IDs de usuário e espaço válidos',
      })
    }

    const query = {
      text: `
        SELECT
          sci.id,
          sci.space_id,
          sci.user_id,
          sci.reservation_id,
          sci.type,
          sci.created_at,
          sci.is_early_checkout,
          sci.early_checkout_status,
          sci.worked_hours,
          sci.justification,
          sci.justified_by,
          sci.justified_at,
          u.name as user_name
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        WHERE sci.user_id = $1 AND sci.space_id = $2
        ORDER BY sci.created_at DESC
      `,
      values: [userId, spaceId],
    }

    const result = await database.query(query)
    return result.rows.map(this.mapToSpaceCheckInOutWithUserName)
  }

  /**
   * Busca registros de check-in/check-out para uma reserva, usuário e espaço específicos
   *
   * @param reservationId ID da reserva
   * @param userId ID do usuário
   * @param spaceId ID do espaço
   * @returns Array de registros de check-in/check-out
   */
  async findByReservationUserAndSpace(
    reservationId: string,
    userId: string,
    spaceId: string,
  ): Promise<SpaceCheckInOut[]> {
    if (!reservationId || !userId || !spaceId) {
      throw new BadRequestError({
        message: 'IDs de reserva, usuário e espaço são obrigatórios',
        action: 'Forneça todos os IDs necessários',
      })
    }

    const query = {
      text: `
        SELECT
          sci.id,
          sci.space_id,
          sci.user_id,
          sci.reservation_id,
          sci.type,
          sci.created_at,
          sci.is_early_checkout,
          sci.early_checkout_status,
          sci.worked_hours,
          sci.justification,
          sci.justified_by,
          sci.justified_at,
          u.name as user_name
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        WHERE sci.reservation_id = $1 AND sci.user_id = $2 AND sci.space_id = $3
        ORDER BY sci.created_at ASC
      `,
      values: [reservationId, userId, spaceId],
    }

    const result = await database.query(query)
    return result.rows.map(this.mapToSpaceCheckInOutWithUserName)
  }

  /**
   * Busca apenas registros de check-in para uma reserva específica
   *
   * @param reservationId ID da reserva
   * @returns Array de registros apenas de check-in
   */
  async findCheckInByReservationId(
    reservationId: string,
  ): Promise<SpaceCheckInOut[]> {
    if (!reservationId) {
      throw new BadRequestError({
        message: 'ID da reserva é obrigatório',
        action: 'Forneça um ID de reserva válido',
      })
    }

    const query = {
      text: `
        SELECT
          sci.id,
          sci.space_id,
          sci.user_id,
          sci.reservation_id,
          sci.type,
          sci.created_at,
          sci.is_early_checkout,
          sci.early_checkout_status,
          sci.worked_hours,
          sci.justification,
          sci.justified_by,
          sci.justified_at,
          u.name as user_name
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        WHERE sci.reservation_id = $1 AND sci.type = 'check-in'
        ORDER BY sci.created_at ASC
      `,
      values: [reservationId],
    }

    const result = await database.query(query)

    if (result.rows.length === 0) {
      // Retornar array vazio quando não há registros de check-in
      return []
    }

    return result.rows.map(this.mapToSpaceCheckInOutWithUserName)
  }

  /**
   * Mapeia um objeto do banco de dados para o formato da entidade, incluindo userName
   */
  private mapToSpaceCheckInOutWithUserName(dbRecord: any): SpaceCheckInOut {
    return {
      id: dbRecord.id,
      spaceId: dbRecord.space_id,
      userId: dbRecord.user_id,
      reservationId: dbRecord.reservation_id,
      type: dbRecord.type,
      createdAt: dbRecord.created_at.toISOString(),
      userName: dbRecord.user_name,
      isEarlyCheckout: dbRecord.is_early_checkout,
      earlyCheckoutStatus: dbRecord.early_checkout_status,
      workedHours: dbRecord.worked_hours
        ? parseFloat(dbRecord.worked_hours)
        : null,
      justification: dbRecord.justification,
      justifiedBy: dbRecord.justified_by,
      justifiedAt: dbRecord.justified_at
        ? dbRecord.justified_at.toISOString()
        : null,
    }
  }

  /**
   * Busca o nome do usuário pelo ID
   */
  private async getUserNameById(userId: string): Promise<string> {
    const result = await database.query({
      text: 'SELECT name FROM users WHERE id = $1',
      values: [userId],
    })
    return result.rows[0]?.name || ''
  }

  /**
   * Mapeia os campos do objeto para colunas do banco de dados
   * @param data Objeto com os dados a serem mapeados
   * @param isUpdate Flag que indica se é uma operação de atualização
   * @returns Objeto com colunas, placeholders e valores para a query SQL
   */
  private mapToDbColumns(
    data: Partial<SpaceCheckInOutUpdate | SpaceCheckInOutCreate>,
    isUpdate = false,
  ) {
    // Remove o ID para não ser incluído na cláusula SET do UPDATE
    const { id, ...dataWithoutId } = data as any

    // Filtra apenas os campos com valores definidos
    const fields = Object.entries(dataWithoutId).filter(
      ([key, value]) => value !== undefined && key !== 'id',
    )

    // Mapeia os nomes de campos para snake_case
    const columns = fields.map(([key], index) =>
      isUpdate
        ? `${this.toSnakeCase(key)} = $${index + 1}`
        : this.toSnakeCase(key),
    )

    const placeholders = fields.map((_, index) => `$${index + 1}`)
    const values = fields.map(([, value]) => value)

    return { columns, placeholders, values }
  }

  /**
   * Converte uma string de camelCase para snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  // ========================================
  // 📌 MÉTODOS PARA EARLY CHECKOUT
  // ========================================

  /**
   * Busca os IDs dos usuários da equipe de um supervisor
   * Retorna os user_ids de todos os subordinados (diretos e indiretos) do supervisor
   * usando uma CTE recursiva para percorrer toda a hierarquia
   */
  async getTeamUserIdsBySupervisor(
    supervisorUserId: string,
  ): Promise<string[]> {
    const query = {
      text: `
        WITH RECURSIVE subordinates AS (
          -- Caso base: subordinados diretos do supervisor
          SELECT
            tms.subordinate_id,
            tp_sub.user_id
          FROM team_positions tp_sup
          JOIN team_member_supervisors tms ON tms.supervisor_id = tp_sup.id
          JOIN team_positions tp_sub ON tp_sub.id = tms.subordinate_id
          WHERE tp_sup.user_id = $1

          UNION ALL

          -- Caso recursivo: subordinados dos subordinados
          SELECT
            tms.subordinate_id,
            tp_sub.user_id
          FROM subordinates s
          JOIN team_member_supervisors tms ON tms.supervisor_id = s.subordinate_id
          JOIN team_positions tp_sub ON tp_sub.id = tms.subordinate_id
        )
        SELECT DISTINCT user_id FROM subordinates
      `,
      values: [supervisorUserId],
    }

    const result = await database.query(query)
    return result.rows.map((row: { user_id: string }) => row.user_id)
  }

  /**
   * Busca indicadores de early checkout (totais por status)
   */
  async getEarlyCheckoutIndicators(filters: EarlyCheckoutFilters): Promise<{
    total: number
    pending: number
    justified: number
    dismissed: number
  }> {
    const conditions: string[] = [
      "sci.type = 'check-out'",
      'sci.is_early_checkout = true',
    ]
    const values: any[] = []
    let paramIndex = 1

    // Filtro por equipe do supervisor
    if (filters.teamUserIds && filters.teamUserIds.length > 0) {
      conditions.push(`sci.user_id = ANY($${paramIndex})`)
      values.push(filters.teamUserIds)
      paramIndex++
    }

    // Filtro por nome do supervisor
    if (filters.supervisorName) {
      conditions.push(`sup_user.name ILIKE $${paramIndex}`)
      values.push(`%${filters.supervisorName}%`)
      paramIndex++
    }

    // Filtro por nome do colaborador
    if (filters.userName) {
      conditions.push(`u.name ILIKE $${paramIndex}`)
      values.push(`%${filters.userName}%`)
      paramIndex++
    }

    // Filtro por email do colaborador
    if (filters.userEmail) {
      conditions.push(`u.email ILIKE $${paramIndex}`)
      values.push(`%${filters.userEmail}%`)
      paramIndex++
    }

    // Filtro por cargo
    if (filters.position) {
      conditions.push(`tp.position = $${paramIndex}`)
      values.push(filters.position)
      paramIndex++
    }

    const query = {
      text: `
        SELECT
          COUNT(*) FILTER (WHERE TRUE) as total,
          COUNT(*) FILTER (WHERE sci.early_checkout_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE sci.early_checkout_status = 'justified') as justified,
          COUNT(*) FILTER (WHERE sci.early_checkout_status = 'dismissed') as dismissed
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        LEFT JOIN team_positions tp ON tp.user_id = sci.user_id
        LEFT JOIN team_member_supervisors tms ON tms.subordinate_id = tp.id
        LEFT JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id
        LEFT JOIN users sup_user ON sup_user.id = tp_sup.user_id
        WHERE ${conditions.join(' AND ')}
        -- Filtrar usuários afastados: não incluir quem está de folga
        AND (
          u.absence_start_date IS NULL
          OR u.absence_end_date IS NULL
          OR CURRENT_DATE NOT BETWEEN u.absence_start_date AND u.absence_end_date
        )
      `,
      values,
    }

    const result = await database.query(query)
    const row = result.rows[0]

    return {
      total: parseInt(row.total, 10) || 0,
      pending: parseInt(row.pending, 10) || 0,
      justified: parseInt(row.justified, 10) || 0,
      dismissed: parseInt(row.dismissed, 10) || 0,
    }
  }

  /**
   * Busca a data da ocorrência pendente mais antiga
   */
  async getOldestPendingEarlyCheckoutDate(
    teamUserIds?: string[],
  ): Promise<Date | null> {
    const conditions: string[] = [
      "sci.type = 'check-out'",
      'sci.is_early_checkout = true',
      "sci.early_checkout_status = 'pending'",
    ]
    const values: any[] = []

    if (teamUserIds && teamUserIds.length > 0) {
      conditions.push('sci.user_id = ANY($1)')
      values.push(teamUserIds)
    }

    const query = {
      text: `
        SELECT MIN(sci.created_at) as oldest_date
        FROM space_check_in_out sci
        WHERE ${conditions.join(' AND ')}
      `,
      values,
    }

    const result = await database.query(query)
    const oldestDate = result.rows[0]?.oldest_date

    return oldestDate ? new Date(oldestDate) : null
  }

  /**
   * Lista ocorrências de early checkout com paginação
   */
  async listEarlyCheckoutOccurrences(
    filters: EarlyCheckoutFilters & { page: number; pageSize: number },
  ): Promise<{
    occurrences: EarlyCheckoutOccurrence[]
    totalItems: number
  }> {
    const conditions: string[] = [
      "sci.type = 'check-out'",
      'sci.is_early_checkout = true',
    ]
    const values: any[] = []
    let paramIndex = 1

    // Filtro por status
    if (filters.status && filters.status !== 'all') {
      conditions.push(`sci.early_checkout_status = $${paramIndex}`)
      values.push(filters.status)
      paramIndex++
    }

    // Filtro por equipe do supervisor
    if (filters.teamUserIds && filters.teamUserIds.length > 0) {
      conditions.push(`sci.user_id = ANY($${paramIndex})`)
      values.push(filters.teamUserIds)
      paramIndex++
    }

    // Filtro por nome do supervisor
    if (filters.supervisorName) {
      conditions.push(`sup_user.name ILIKE $${paramIndex}`)
      values.push(`%${filters.supervisorName}%`)
      paramIndex++
    }

    // Filtro por nome do colaborador
    if (filters.userName) {
      conditions.push(`u.name ILIKE $${paramIndex}`)
      values.push(`%${filters.userName}%`)
      paramIndex++
    }

    // Filtro por email do colaborador
    if (filters.userEmail) {
      conditions.push(`u.email ILIKE $${paramIndex}`)
      values.push(`%${filters.userEmail}%`)
      paramIndex++
    }

    // Filtro por cargo
    if (filters.position) {
      conditions.push(`tp.position = $${paramIndex}`)
      values.push(filters.position)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')
    const offset = (filters.page - 1) * filters.pageSize

    // CTE recursiva para encontrar o supervisor real (cargo = 'supervisor') na hierarquia
    const hierarchyCTE = `
      WITH RECURSIVE hierarchy_chain AS (
        -- Caso base: começa do subordinado e sobe para seu supervisor direto
        SELECT
          tms.subordinate_id AS original_position_id,
          tms.supervisor_id AS current_position_id,
          tp_sup.position AS current_position,
          tp_sup.user_id AS current_user_id,
          1 AS level
        FROM team_member_supervisors tms
        JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id

        UNION ALL

        -- Caso recursivo: continua subindo na hierarquia até encontrar um supervisor
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
      -- Seleciona apenas o primeiro supervisor (cargo = 'supervisor') encontrado na hierarquia
      real_supervisors AS (
        SELECT DISTINCT ON (hc.original_position_id)
          hc.original_position_id,
          hc.current_user_id AS supervisor_user_id
        FROM hierarchy_chain hc
        WHERE hc.current_position = 'supervisor'
        ORDER BY hc.original_position_id, hc.level ASC
      )
    `

    // Query para contar total
    const countQuery = {
      text: `
        ${hierarchyCTE}
        SELECT COUNT(*) as total
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        LEFT JOIN team_positions tp ON tp.user_id = sci.user_id
        LEFT JOIN real_supervisors rs ON rs.original_position_id = tp.id
        LEFT JOIN users sup_user ON sup_user.id = rs.supervisor_user_id
        WHERE ${whereClause}
        -- Filtrar usuários afastados: não incluir quem está de folga
        AND (
          u.absence_start_date IS NULL
          OR u.absence_end_date IS NULL
          OR CURRENT_DATE NOT BETWEEN u.absence_start_date AND u.absence_end_date
        )
      `,
      values,
    }

    const countResult = await database.query(countQuery)
    const totalItems = parseInt(countResult.rows[0]?.total, 10) || 0

    // Query para buscar ocorrências
    const listQuery = {
      text: `
        ${hierarchyCTE}
        SELECT
          sci.id,
          sci.user_id,
          u.name as user_name,
          u.email as user_email,
          u.avatar as user_avatar,
          tp.position,
          rs.supervisor_user_id as supervisor_id,
          sup_user.name as supervisor_name,
          sup_user.email as supervisor_email,
          check_in.created_at as check_in_at,
          sci.created_at as check_out_at,
          sci.worked_hours,
          sci.early_checkout_status as status,
          sci.justification,
          justified_user.name as justified_by_name,
          sci.justified_at,
          sci.space_id,
          s.name as space_name,
          sci.reservation_id
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        JOIN spaces s ON s.id = sci.space_id
        LEFT JOIN team_positions tp ON tp.user_id = sci.user_id
        LEFT JOIN real_supervisors rs ON rs.original_position_id = tp.id
        LEFT JOIN users sup_user ON sup_user.id = rs.supervisor_user_id
        LEFT JOIN users justified_user ON justified_user.id = sci.justified_by
        LEFT JOIN space_check_in_out check_in ON (
          check_in.reservation_id = sci.reservation_id
          AND check_in.user_id = sci.user_id
          AND check_in.type = 'check-in'
        )
        WHERE ${whereClause}
        -- Filtrar usuários afastados: não incluir quem está de folga
        AND (
          u.absence_start_date IS NULL
          OR u.absence_end_date IS NULL
          OR CURRENT_DATE NOT BETWEEN u.absence_start_date AND u.absence_end_date
        )
        ORDER BY sci.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values: [...values, filters.pageSize, offset],
    }

    const listResult = await database.query(listQuery)

    const occurrences: EarlyCheckoutOccurrence[] = listResult.rows.map(
      (row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        userAvatar: row.user_avatar,
        position: row.position as EarlyCheckoutOccurrence['position'],
        supervisorId: row.supervisor_id,
        supervisorName: row.supervisor_name,
        supervisorEmail: row.supervisor_email,
        checkInAt: row.check_in_at ? row.check_in_at.toISOString() : '',
        checkOutAt: row.check_out_at.toISOString(),
        workedHours: row.worked_hours ? parseFloat(row.worked_hours) : 0,
        status: row.status as EarlyCheckoutStatus,
        justification: row.justification,
        justifiedByName: row.justified_by_name,
        justifiedAt: row.justified_at ? row.justified_at.toISOString() : null,
        spaceId: row.space_id,
        spaceName: row.space_name,
        reservationId: row.reservation_id,
      }),
    )

    return { occurrences, totalItems }
  }

  /**
   * Busca uma ocorrência de early checkout por ID
   */
  async findEarlyCheckoutById(
    id: string,
  ): Promise<EarlyCheckoutOccurrence | null> {
    const query = {
      text: `
        WITH RECURSIVE hierarchy_chain AS (
          -- Caso base: começa do subordinado e sobe para seu supervisor direto
          SELECT
            tms.subordinate_id AS original_position_id,
            tms.supervisor_id AS current_position_id,
            tp_sup.position AS current_position,
            tp_sup.user_id AS current_user_id,
            1 AS level
          FROM team_member_supervisors tms
          JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id

          UNION ALL

          -- Caso recursivo: continua subindo na hierarquia até encontrar um supervisor
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
        -- Seleciona apenas o primeiro supervisor (cargo = 'supervisor') encontrado na hierarquia
        real_supervisors AS (
          SELECT DISTINCT ON (hc.original_position_id)
            hc.original_position_id,
            hc.current_user_id AS supervisor_user_id
          FROM hierarchy_chain hc
          WHERE hc.current_position = 'supervisor'
          ORDER BY hc.original_position_id, hc.level ASC
        )
        SELECT
          sci.id,
          sci.user_id,
          u.name as user_name,
          u.email as user_email,
          u.avatar as user_avatar,
          tp.position,
          rs.supervisor_user_id as supervisor_id,
          sup_user.name as supervisor_name,
          sup_user.email as supervisor_email,
          check_in.created_at as check_in_at,
          sci.created_at as check_out_at,
          sci.worked_hours,
          sci.early_checkout_status as status,
          sci.justification,
          justified_user.name as justified_by_name,
          sci.justified_at,
          sci.space_id,
          s.name as space_name,
          sci.reservation_id
        FROM space_check_in_out sci
        JOIN users u ON u.id = sci.user_id
        JOIN spaces s ON s.id = sci.space_id
        LEFT JOIN team_positions tp ON tp.user_id = sci.user_id
        LEFT JOIN real_supervisors rs ON rs.original_position_id = tp.id
        LEFT JOIN users sup_user ON sup_user.id = rs.supervisor_user_id
        LEFT JOIN users justified_user ON justified_user.id = sci.justified_by
        LEFT JOIN space_check_in_out check_in ON (
          check_in.reservation_id = sci.reservation_id
          AND check_in.user_id = sci.user_id
          AND check_in.type = 'check-in'
        )
        WHERE sci.id = $1
          AND sci.type = 'check-out'
          AND sci.is_early_checkout = true
      `,
      values: [id],
    }

    const result = await database.query(query)

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      userAvatar: row.user_avatar,
      position: row.position as EarlyCheckoutOccurrence['position'],
      supervisorId: row.supervisor_id,
      supervisorName: row.supervisor_name,
      supervisorEmail: row.supervisor_email,
      checkInAt: row.check_in_at ? row.check_in_at.toISOString() : '',
      checkOutAt: row.check_out_at.toISOString(),
      workedHours: row.worked_hours ? parseFloat(row.worked_hours) : 0,
      status: row.status as EarlyCheckoutStatus,
      justification: row.justification,
      justifiedByName: row.justified_by_name,
      justifiedAt: row.justified_at ? row.justified_at.toISOString() : null,
      spaceId: row.space_id,
      spaceName: row.space_name,
      reservationId: row.reservation_id,
    }
  }

  /**
   * Atualiza a justificativa de uma ocorrência de early checkout
   */
  async justifyEarlyCheckout(input: {
    id: string
    status: EarlyCheckoutStatus
    justification: string | null
    justifiedBy: string
  }): Promise<void> {
    const query = {
      text: `
        UPDATE space_check_in_out
        SET
          early_checkout_status = $2,
          justification = $3,
          justified_by = $4,
          justified_at = NOW()
        WHERE id = $1
          AND type = 'check-out'
          AND is_early_checkout = true
      `,
      values: [input.id, input.status, input.justification, input.justifiedBy],
    }

    await database.query(query)
  }
}
