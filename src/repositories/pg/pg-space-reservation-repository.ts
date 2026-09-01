// src/repositories/pg/pg-space-reservation-repository.ts
import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import { format as formatTz, toZonedTime } from 'date-fns-tz'
import { SpaceCheckInOut } from '../base/space-check-in-out-repository'
import {
  CancelledReservation,
  CancelledReservationsFilters,
  ISpaceReservationRepository,
  PaginatedCancelledReservations,
  PaginatedReservations,
  ReservationDetail,
  SpaceReservation,
  SpaceReservationCreate,
  SpaceReservationStats,
} from '../base/space-reservation-repository'

/**
 * Data de corte para contabilização de cancelamentos fora do prazo.
 *
 * Cancelamentos com closed_at ANTES desta data são ignorados nos indicadores
 * de "Cancelamentos Fora do Prazo", pois esta funcionalidade foi implementada
 * em 23/01/2026 e os dados anteriores não devem ser contabilizados.
 *
 * Formato: ISO 8601 (YYYY-MM-DD)
 */
const CANCELLED_RESERVATIONS_CUTOFF_DATE = '2026-01-23'

export class PgSpaceReservationRepository implements ISpaceReservationRepository {
  async create(input: SpaceReservationCreate): Promise<SpaceReservation> {
    if (
      !input.spaceId ||
      !input.userId ||
      !input.spaceSlotIds ||
      !Array.isArray(input.spaceSlotIds) ||
      input.spaceSlotIds.length === 0 ||
      !input.slotRange
    ) {
      throw new BadRequestError({
        message: 'Dados incompletos para criar reserva',
        action:
          'Forneça spaceId, userId, pelo menos um spaceSlotId e slotRange válidos',
      })
    }

    const query = {
      text: `
        INSERT INTO space_reservations (
          space_id,
          user_id,
          space_slot_ids,
          slot_range,
          bbz_collaborators,
          external_guests,
          needs_copeira
        ) VALUES (
          $1,
          $2,
          $3,
          tstzrange($4, $5, '[)'),
          $6,
          $7,
          $8
        ) RETURNING
          id,
          space_id,
          user_id,
          space_slot_ids,
          slot_range,
          bbz_collaborators,
          external_guests,
          needs_copeira,
          status,
          cancelled_by,
          cancel_reason,
          cancelled_at,
          closed_at,
          created_at,
          updated_at
      `,
      values: [
        input.spaceId,
        input.userId,
        JSON.stringify(input.spaceSlotIds), // Array de IDs como JSONB
        input.slotRange[0],
        input.slotRange[1],
        JSON.stringify(input.bbzCollaborators || []),
        JSON.stringify(input.externalGuests || []),
        input.needsCopeira || false,
      ],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao criar reserva',
        action: 'Verifique os dados e tente novamente',
      })
    }

    return this.mapToSpaceReservation(result.rows[0])
  }

  async findById(id: string): Promise<SpaceReservation | null> {
    if (!id) {
      throw new BadRequestError({
        message: 'ID da reserva é obrigatório',
        action: 'Forneça um ID válido',
      })
    }

    const query = {
      text: `
        SELECT
          id,
          space_id,
          user_id,
          space_slot_ids,
          slot_range,
          bbz_collaborators,
          external_guests,
          needs_copeira,
          status,
          cancelled_by,
          cancel_reason,
          cancelled_at,
          closed_at,
          created_at,
          updated_at
        FROM space_reservations
        WHERE id = $1
        LIMIT 1
      `,
      values: [id],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      return null
    }

    return this.mapToSpaceReservation(result.rows[0])
  }

  /**
   * Busca uma reserva que contenha os IDs de slots especificados no array JSONB space_slot_ids
   */
  async findBySpaceSlotIds(
    spaceSlotIds: string[],
  ): Promise<SpaceReservation | null> {
    if (!spaceSlotIds || !spaceSlotIds.length) {
      throw new BadRequestError({
        message: 'Pelo menos um ID de slot de espaço é obrigatório',
        action: 'Forneça um array válido de IDs de slots',
      })
    }

    // Busca por reservas onde o array de IDs de slots está contido no array JSONB space_slot_ids
    // usando o operador @> (contains) do PostgreSQL para JSONB
    const query = {
      text: `
        SELECT
          id,
          space_id,
          user_id,
          space_slot_ids,
          slot_range,
          bbz_collaborators,
          external_guests,
          needs_copeira,
          status,
          cancelled_by,
          cancel_reason,
          cancelled_at,
          closed_at,
          created_at,
          updated_at
        FROM space_reservations
        WHERE space_slot_ids @> $1::jsonb
        LIMIT 1
      `,
      values: [JSON.stringify(spaceSlotIds)],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      return null
    }

    return this.mapToSpaceReservation(result.rows[0])
  }

  async cancelReservation(
    id: string,
    cancelledBy: string,
    cancelReason: string,
  ): Promise<SpaceReservation> {
    if (!id || !cancelledBy) {
      throw new BadRequestError({
        message: 'ID da reserva e ID do cancelador são obrigatórios',
        action: 'Forneça id e cancelledBy válidos',
      })
    }

    const query = {
      text: `
        UPDATE space_reservations
        SET
          status = 'cancelled',
          cancelled_by = $2,
          cancel_reason = $3,
          cancelled_at = (now() AT TIME ZONE 'utc'),
          updated_at = (now() AT TIME ZONE 'utc')
        WHERE
          id = $1 AND
          status = 'reserved'
        RETURNING
          id,
          space_id,
          user_id,
          space_slot_ids,
          slot_range,
          bbz_collaborators,
          external_guests,
          needs_copeira,
          status,
          cancelled_by,
          cancel_reason,
          cancelled_at,
          closed_at,
          created_at,
          updated_at
      `,
      values: [id, cancelledBy, cancelReason],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      throw new BadRequestError({
        message: 'Reserva não encontrada ou já está cancelada/encerrada',
        action: 'Verifique o ID da reserva e seu status atual',
      })
    }

    return this.mapToSpaceReservation(result.rows[0])
  }

  async closeReservation(
    id: string,
    userId: string,
  ): Promise<SpaceReservation> {
    if (!id || !userId) {
      throw new BadRequestError({
        message: 'ID da reserva e ID do usuário são obrigatórios',
        action: 'Forneça id e userId válidos',
      })
    }

    const query = {
      text: `
        UPDATE space_reservations
        SET
          status = 'closed',
          closed_at = (now() AT TIME ZONE 'utc'),
          updated_at = (now() AT TIME ZONE 'utc')
        WHERE
          id = $1 AND
          user_id = $2 AND
          status = 'reserved'
        RETURNING
          id,
          space_id,
          user_id,
          space_slot_ids,
          slot_range,
          bbz_collaborators,
          external_guests,
          needs_copeira,
          status,
          cancelled_by,
          cancel_reason,
          cancelled_at,
          closed_at,
          created_at,
          updated_at
      `,
      values: [id, userId],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      throw new BadRequestError({
        message:
          'Reserva não encontrada, você não é o dono da reserva, ou ela já está cancelada/encerrada',
        action: 'Verifique o ID da reserva e seu status atual',
      })
    }

    return this.mapToSpaceReservation(result.rows[0])
  }

  async listReservations(
    page: number = 1,
    pageSize: number = 20,
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
  ): Promise<PaginatedReservations> {
    // Cálculo do offset para paginação
    const offset = (page - 1) * pageSize

    // Construir condições WHERE com base nos filtros
    const whereConditions = []
    const queryParams = []
    let paramCounter = 1
    let userFilterAdded = false

    // Filtro por espaço
    if (filters?.spaceId) {
      whereConditions.push(`sr.space_id = $${paramCounter}`)
      queryParams.push(filters.spaceId)
      paramCounter++
    }

    // Filtro por lista de usuários (para filtrar por equipe)
    if (filters?.userIds && filters.userIds.length > 0) {
      whereConditions.push(`sr.user_id = ANY($${paramCounter}::uuid[])`)
      queryParams.push(filters.userIds)
      paramCounter++
      userFilterAdded = true
    }
    // Filtro por usuário - vamos tratar de forma especial se includeUserAsGuest for true
    else if (filters?.userId) {
      // Se também precisamos incluir reservas onde o usuário é convidado
      if (filters.includeUserAsGuest && filters.userEmail) {
        // Precisamos do email para buscar nas listas de convidados
        whereConditions.push(`(
          sr.user_id = $${paramCounter}
          OR sr.bbz_collaborators @> $${paramCounter + 1}::jsonb
          OR sr.external_guests @> $${paramCounter + 1}::jsonb
        )`)
        queryParams.push(filters.userId)
        queryParams.push(JSON.stringify([filters.userEmail])) // JSONB array com o email
        paramCounter += 2
        userFilterAdded = true
      } else {
        // Comportamento padrão - apenas reservas criadas pelo usuário
        whereConditions.push(`sr.user_id = $${paramCounter}`)
        queryParams.push(filters.userId)
        paramCounter++
        userFilterAdded = true
      }
    }

    // Filtro por status
    if (filters?.status) {
      whereConditions.push(`sr.status = $${paramCounter}`)
      queryParams.push(filters.status)
      paramCounter++
    }

    // Filtro por período (usando o slot_range da reserva, não do slot)
    if (filters?.startDate || filters?.endDate) {
      if (filters.startDate) {
        whereConditions.push(`lower(sr.slot_range) >= $${paramCounter}`)
        queryParams.push(new Date(filters.startDate).toISOString())
        paramCounter++
      }

      if (filters.endDate) {
        whereConditions.push(`upper(sr.slot_range) <= $${paramCounter}`)
        queryParams.push(new Date(filters.endDate).toISOString())
        paramCounter++
      }
    }

    // Montar a cláusula WHERE final
    // Se não houver condições, retorna TODAS as reservas
    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Consulta principal para obter os dados
    const query = {
      text: `
        SELECT
          sr.id,
          sr.space_id,
          s.name as space_name,
          s.type as space_type,
          s.floor as space_floor,
          s.zone as space_zone,
          s.position as space_position,
          sr.space_slot_ids,
          sr.slot_range,
          sr.user_id,
          u.name as user_name,
          u.email as user_email,
          sr.bbz_collaborators,
          sr.external_guests,
          sr.needs_copeira,
          sr.status,
          sr.cancelled_by,
          cb.name as canceller_name,
          sr.cancel_reason,
          sr.cancelled_at,
          sr.closed_at,
          sr.created_at,
          COUNT(*) OVER() AS total_count
        FROM
          space_reservations sr
        JOIN
          spaces s ON sr.space_id = s.id
        JOIN
          users u ON sr.user_id = u.id
        LEFT JOIN
          users cb ON sr.cancelled_by = cb.id
        ${whereClause}
        ORDER BY
          lower(sr.slot_range) DESC
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
      `,
      values: [...queryParams, pageSize, offset],
    }

    const result = await database.query(query)

    // Se não houver resultados, retornar uma lista vazia com paginação adequada
    if (result.rows.length === 0) {
      return {
        reservations: [], // Array vazio de ReservationDetail
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      }
    }

    // Mapear os resultados para o formato desejado (array de ReservationDetail)
    const reservations = result.rows.map((row: any) =>
      this.mapToReservationDetail(row),
    )

    // Limitar para no máximo 5 requisições simultâneas ao banco pois no pool o máximo é 20 então limitamos para evitar problemas de concorrência
    const pLimit = (await import('p-limit')).default
    const limit = pLimit(5)

    // Para cada reserva, buscar os registros de check-in/check-out
    await Promise.all(
      reservations.map((reservation: ReservationDetail) =>
        limit(async () => {
          reservation.checkInOuts = await this.getCheckInOutsByReservationId(
            reservation.id,
          )
        }),
      ),
    )

    // Calcular total de páginas
    const totalCount = parseInt(result.rows[0]?.total_count || '0')
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      reservations,
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  async getUserReservationStats(
    userId: string,
  ): Promise<SpaceReservationStats> {
    if (!userId) {
      throw new BadRequestError({
        message: 'ID do usuário é obrigatório',
        action: 'Forneça um ID de usuário válido',
      })
    }

    // Total reservations agrupadas por espaço e slots consecutivos
    // Usamos window functions para identificar sequências de slots
    const totalQuery = {
      text: `
        WITH reservations AS (
          SELECT
            space_id,
            slot_range,
            -- Esta parte identifica quando começa uma nova sequência (novo espaço ou intervalo não consecutivo)
            CASE
              WHEN LAG(space_id) OVER (ORDER BY space_id, lower(slot_range)) IS DISTINCT FROM space_id
                OR lower(slot_range) <> LAG(upper(slot_range)) OVER (ORDER BY space_id, lower(slot_range))
              THEN 1
              ELSE 0
            END AS is_new_sequence
          FROM space_reservations
          WHERE
            user_id = $1
            AND status = 'reserved'
            AND upper(slot_range) > now()
          ORDER BY space_id, lower(slot_range)
        ),
        grouped_reservations AS (
          SELECT
            space_id,
            -- Soma cumulativa para agrupar sequências na mesma espaço
            SUM(is_new_sequence) OVER (ORDER BY space_id, lower(slot_range)) AS sequence_group
          FROM reservations
        )
        -- Conta quantos grupos distintos temos (cada grupo = uma reserva lógica)
        SELECT COUNT(DISTINCT sequence_group) AS total
        FROM grouped_reservations
      `,
      values: [userId],
    }

    const totalResult = await database.query(totalQuery)
    const total = parseInt(totalResult.rows[0]?.total || '0', 10)

    // Next reservation (status reserved and future slot)
    const nextQuery = {
      text: `SELECT slot_range FROM space_reservations
        WHERE user_id = $1 AND status = 'reserved' AND lower(slot_range) > now()
        ORDER BY lower(slot_range) ASC LIMIT 1`,
      values: [userId],
    }
    const nextResult = await database.query(nextQuery)
    let nextReservation: string | null = null
    if (nextResult.rows[0]?.slot_range) {
      // Extrair a data ISO da string
      const dateStr =
        nextResult.rows[0].slot_range.match(/"(.*?)"/)?.[1] ||
        nextResult.rows[0].slot_range.split(',')[0].replace(/[[(]/g, '')

      // Definir o fuso horário do Brasil
      const tz = 'America/Sao_Paulo'

      // Converter para o fuso horário correto
      const start = toZonedTime(new Date(dateStr), tz)

      // Formatar a data e hora no formato desejado
      nextReservation = formatTz(start, "dd/MM/yyyy 'às' HH:mm", {
        timeZone: tz,
      })
    }

    // Three most used start times
    const timesQuery = {
      text: `SELECT to_char(lower(slot_range) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as time, COUNT(*) as qtd
        FROM space_reservations
        WHERE user_id = $1
        GROUP BY time
        ORDER BY qtd DESC, time ASC
        LIMIT 10`,
      values: [userId],
    }
    const timesResult = await database.query(timesQuery)
    // Sort from smallest to largest
    const mostUsedStartTimes = timesResult.rows
      .map((row: any) => row.time)
      .sort()

    return {
      total,
      nextReservation,
      mostUsedStartTimes,
    }
  }

  /**
   * Busca uma reserva pelo ID e retorna com detalhes (espaço, usuário e cancelador)
   *
   * @param id ID da reserva a ser buscada
   * @returns Detalhes completos da reserva ou null se não encontrada
   */
  async getReservationDetailById(
    id: string,
  ): Promise<ReservationDetail | null> {
    if (!id) {
      throw new BadRequestError({
        message: 'ID da reserva é obrigatório',
        action: 'Forneça um ID válido para buscar os detalhes da reserva',
      })
    }

    const query = {
      text: `
        SELECT
          sr.id,
          sr.space_id,
          s.name as space_name,
          s.type as space_type,
          s.floor as space_floor,
          s.zone as space_zone,
          s.position as space_position,
          sr.space_slot_ids,
          sr.slot_range,
          sr.user_id,
          u.name as user_name,
          u.email as user_email,
          sr.bbz_collaborators,
          sr.external_guests,
          sr.needs_copeira,
          sr.status,
          sr.cancelled_by,
          cb.name as canceller_name,
          sr.cancel_reason,
          sr.cancelled_at,
          sr.closed_at,
          sr.created_at
        FROM
          space_reservations sr
        JOIN
          spaces s ON sr.space_id = s.id
        JOIN
          users u ON sr.user_id = u.id
        LEFT JOIN
          users cb ON sr.cancelled_by = cb.id
        WHERE
          sr.id = $1
        LIMIT 1
      `,
      values: [id],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      return null
    }

    // Mapeia os dados básicos da reserva
    const reservationDetail = this.mapToReservationDetail(result.rows[0])

    // Busca os registros de check-in/check-out para esta reserva
    reservationDetail.checkInOuts = await this.getCheckInOutsByReservationId(id)

    return reservationDetail
  }

  /**
   * Método auxiliar para buscar os registros de check-in/check-out para uma reserva
   */
  private async getCheckInOutsByReservationId(
    reservationId: string,
  ): Promise<SpaceCheckInOut[]> {
    const query = {
      text: `
        SELECT
          id,
          space_id,
          user_id,
          reservation_id,
          type,
          created_at
        FROM
          space_check_in_out
        WHERE
          reservation_id = $1
        ORDER BY
          created_at ASC
      `,
      values: [reservationId],
    }

    const result = await database.query(query)

    return result.rows.map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      reservationId: row.reservation_id,
      type: row.type,
      createdAt: row.created_at.toISOString(),
    }))
  }

  /**
   * Converte o resultado do banco de dados para o formato da entidade SpaceReservation
   */
  private mapToSpaceReservation(row: any): SpaceReservation {
    return {
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      spaceSlotIds: row.space_slot_ids || [], // Usar array JSONB de IDs
      slotRange: this.parseRange(row.slot_range).map((d) =>
        d.toISOString(),
      ) as [string, string],
      bbzCollaborators: row.bbz_collaborators || [],
      externalGuests: row.external_guests || [],
      needsCopeira: row.needs_copeira,
      status: row.status,
      cancelledBy: row.cancelled_by,
      cancelReason: row.cancel_reason,
      cancelledAt: row.cancelled_at?.toISOString() || null,
      closedAt: row.closed_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      attendanceStatus: row.attendance_status || 'pending',
      emailNotificationStatus: row.email_notification_status || 'not-evaluated',
    }
  }

  /**
   * Mapeia uma linha do resultado da consulta para o formato ReservationDetail
   */
  private mapToReservationDetail(row: any): ReservationDetail {
    // slotRange nunca será nulo, sempre retorna [string, string]
    const slotRangeArr = this.parseRange(row.slot_range)
    const slotRange: [string, string] = [
      slotRangeArr[0].toISOString(),
      slotRangeArr[1].toISOString(),
    ]

    return {
      id: row.id,
      space: {
        id: row.space_id,
        name: row.space_name,
        type: row.space_type || 'room', // Definindo 'room' como padrão caso não tenha o valor
        floor: row.space_floor,
        zone: row.space_zone,
        position: row.space_position,
      },
      spaceSlotIds: Array.isArray(row.space_slot_ids)
        ? row.space_slot_ids
        : typeof row.space_slot_ids === 'string'
          ? JSON.parse(row.space_slot_ids)
          : [],
      slotRange: slotRange, // nunca nulo
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
      },
      bbzCollaborators: row.bbz_collaborators || [],
      externalGuests: row.external_guests || [],
      needsCopeira: row.needs_copeira,
      status: row.status,
      cancelledBy: row.cancelled_by
        ? {
            id: row.cancelled_by,
            name: row.canceller_name,
          }
        : null,
      cancelReason: row.cancel_reason,
      cancelledAt: row.cancelled_at?.toISOString() || null,
      closedAt: row.closed_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      checkInOuts: [], // Inicialmente vazio, será preenchido posteriormente
      attendanceStatus: row.attendance_status || 'pending',
      emailNotificationStatus: row.email_notification_status || 'not-evaluated',
    }
  }

  /**
   * Função utilitária para parsear o formato de range do PostgreSQL para um array de datas
   * Similar ao parseRange do SpaceSlotRepository
   */
  private parseRange(rangeStr: string): Date[] {
    if (!rangeStr) {
      return []
    }

    // Remove os colchetes e divide por vírgula
    const dates = rangeStr.replace(/[()[\]]/g, '').split(',')

    // Converte as strings para objetos Date
    return dates.map((dateStr) => new Date(dateStr.trim()))
  }

  /**
   * Conta quantos dias distintos o usuário tem reservas de workstations em um período
   *
   * Esta função é usada para verificar compliance de reservas semanais.
   * Conta apenas reservas de workstations (não salas) com status 'reserved'.
   *
   * @param userId ID do usuário
   * @param startDate Data de início do período
   * @param endDate Data de fim do período
   * @returns Número de dias distintos com reservas
   */
  async countUserWorkstationDaysByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    if (!userId) {
      throw new BadRequestError({
        message: 'ID do usuário é obrigatório',
        action: 'Forneça um userId válido',
      })
    }

    const query = {
      text: `
        SELECT COUNT(DISTINCT DATE(LOWER(sr.slot_range))) as day_count
        FROM space_reservations sr
        JOIN spaces s ON s.id = sr.space_id
        WHERE sr.user_id = $1
          AND s.type = 'workstation'
          AND sr.status = 'reserved'
          AND sr.slot_range && tstzrange($2, $3, '[)')
      `,
      values: [userId, startDate.toISOString(), endDate.toISOString()],
    }

    const result = await database.query(query)

    return parseInt(result.rows[0]?.day_count || '0', 10)
  }

  /**
   * Lista usuários que não cumpriram a exigência de reservas semanais
   *
   * Retorna todos os colaboradores (manager, assistant_manager, assistant) que devem
   * cumprir a regra de reservas, com informações sobre quantos dias reservaram.
   *
   * @param startDate Data de início da semana
   * @param endDate Data de fim da semana
   * @param supervisorPositionId ID da posição do supervisor (opcional - filtra por equipe)
   * @param isCurrentWeek Se true, conta também reservas 'closed' com 'checked-out'
   * @returns Lista de usuários com dados de compliance
   */
  async listNonCompliantUsers(
    startDate: Date,
    endDate: Date,
    supervisorPositionId?: string,
    isCurrentWeek: boolean = false,
  ): Promise<
    Array<{
      userId: string
      userName: string | null
      userEmail: string
      position: string
      supervisorName: string | null
      requiredDays: number
      reservedDays: number
      isCompliant: boolean
    }>
  > {
    // Query com CTE recursiva para buscar todos os subordinados (diretos e indiretos)
    const baseQuery = `
      WITH RECURSIVE subordinates AS (
        -- Caso base: subordinados diretos
        SELECT
          tms.subordinate_id,
          tms.supervisor_id
        FROM team_member_supervisors tms
        ${supervisorPositionId ? 'WHERE tms.supervisor_id = $3' : ''}

        UNION ALL

        -- Caso recursivo: subordinados dos subordinados
        SELECT
          tms.subordinate_id,
          tms.supervisor_id
        FROM team_member_supervisors tms
        INNER JOIN subordinates s ON tms.supervisor_id = s.subordinate_id
      ),
      -- CTE recursiva para encontrar o supervisor real (cargo = 'supervisor') na hierarquia
      hierarchy_chain AS (
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
        WHERE hc.current_position != 'supervisor' -- para quando encontrar supervisor
      ),
      -- Seleciona apenas o primeiro supervisor (cargo = 'supervisor') encontrado na hierarquia
      real_supervisors AS (
        SELECT DISTINCT ON (hc.original_position_id)
          hc.original_position_id,
          hc.current_user_id AS supervisor_user_id,
          u_sup.name AS supervisor_name
        FROM hierarchy_chain hc
        JOIN users u_sup ON u_sup.id = hc.current_user_id
        WHERE hc.current_position = 'supervisor'
        ORDER BY hc.original_position_id, hc.level ASC
      ),
      user_positions AS (
        SELECT
          tp.id AS position_id,
          tp.user_id,
          tp.position,
          u.name AS user_name,
          u.email AS user_email,
          CASE
            WHEN tp.position = 'manager' THEN 2
            WHEN tp.position = 'assistant_manager' THEN 3
            WHEN tp.position = 'assistant' THEN 3
            ELSE 0
          END AS required_days
        FROM team_positions tp
        JOIN users u ON u.id = tp.user_id
        WHERE tp.position IN ('manager', 'assistant_manager', 'assistant')
        ${supervisorPositionId ? 'AND tp.id IN (SELECT subordinate_id FROM subordinates)' : ''}
        -- Filtrar usuários afastados: não incluir quem está de folga no período da semana analisada
        -- O afastamento se sobrepõe ao período se NÃO (termina antes OU começa depois)
        AND (
          u.absence_start_date IS NULL
          OR u.absence_end_date IS NULL
          OR u.absence_end_date < DATE($1)  -- afastamento termina antes do início da semana
          OR u.absence_start_date > DATE($2) -- afastamento começa depois do fim da semana
        )
        -- Filtrar usuários em Posto Avançado: completamente isentos de compliance
        -- O posto avançado se sobrepõe ao período se NÃO (termina antes OU começa depois)
        AND NOT EXISTS (
          SELECT 1 FROM user_outposts uo
          WHERE uo.user_id = tp.user_id
            AND uo.start_date <= DATE($2)  -- posto começa até o fim da semana
            AND (uo.end_date IS NULL OR uo.end_date >= DATE($1))  -- posto termina depois do início da semana
        )
      ),
      user_reservations AS (
        SELECT
          sr.user_id,
          COUNT(DISTINCT DATE(LOWER(sr.slot_range))) as reserved_days
        FROM space_reservations sr
        JOIN spaces s ON s.id = sr.space_id
        ${
          isCurrentWeek
            ? `
        -- Na semana corrente, busca check-ins e check-outs
        LEFT JOIN LATERAL (
          SELECT
            bool_or(type = 'check-in') as has_check_in,
            bool_or(type = 'check-out') as has_check_out
          FROM space_check_in_out
          WHERE reservation_id = sr.id
        ) cio ON true
        `
            : ''
        }
        WHERE s.type = 'workstation'
          AND sr.slot_range && tstzrange($1, $2, '[)')
          AND (
            sr.status = 'reserved'
            ${
              isCurrentWeek
                ? `OR (sr.status = 'closed' AND cio.has_check_in = true AND cio.has_check_out = true)`
                : ''
            }
          )
        GROUP BY sr.user_id
      )
      SELECT
        up.user_id,
        up.user_name,
        up.user_email,
        up.position,
        rs.supervisor_name,
        up.required_days,
        COALESCE(ur.reserved_days, 0) as reserved_days,
        CASE
          WHEN COALESCE(ur.reserved_days, 0) >= up.required_days THEN true
          ELSE false
        END as is_compliant
      FROM user_positions up
      LEFT JOIN user_reservations ur ON ur.user_id = up.user_id
      LEFT JOIN real_supervisors rs ON rs.original_position_id = up.position_id
      ORDER BY up.user_name ASC
    `

    const values = supervisorPositionId
      ? [startDate.toISOString(), endDate.toISOString(), supervisorPositionId]
      : [startDate.toISOString(), endDate.toISOString()]

    const result = await database.query({
      text: baseQuery,
      values,
    })

    return result.rows.map(
      (row: {
        user_id: string
        user_name: string | null
        user_email: string
        position: string
        supervisor_name: string | null
        required_days: string | number
        reserved_days: string | number
        is_compliant: boolean | string
      }) => ({
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        position: row.position,
        supervisorName: row.supervisor_name,
        requiredDays: Number(row.required_days),
        reservedDays: Number(row.reserved_days),
        isCompliant: row.is_compliant === true || row.is_compliant === 'true',
      }),
    )
  }

  /**
   * Conta reservas de workstation encerradas após o prazo de planejamento
   *
   * O prazo de planejamento de uma reserva é até quinta-feira (23:59:59) da semana
   * anterior à semana da reserva. Se o usuário encerrou após esse prazo, conta
   * como cancelamento fora do prazo.
   */
  async countCancelledReservations(
    filters?: CancelledReservationsFilters,
  ): Promise<number> {
    // Monta a query para contar reservas canceladas após o prazo
    // A lógica do prazo é: quinta-feira da semana anterior à reserva
    // Usamos DATE_TRUNC('week', LOWER(sr.slot_range)) para pegar início da semana da reserva
    // Depois subtraímos 3 dias para chegar na quinta-feira da semana anterior
    // (início da semana = segunda, quinta = segunda - 3 dias da semana anterior = domingo + 4 = quinta)
    // Na verdade: início da semana (segunda) - 3 dias = sexta anterior, então precisamos
    // de início da semana - 4 dias + fim do dia (23:59:59.999)
    const baseQuery = `
      WITH RECURSIVE
      -- CTE para buscar subordinados do supervisor logado (quando há filtro)
      supervisor_subordinates AS (
        -- Caso base: subordinados diretos do supervisor
        SELECT tms.subordinate_id
        FROM team_member_supervisors tms
        ${filters?.supervisorPositionId ? `WHERE tms.supervisor_id = $${this.getNextParamIndex(filters, 'supervisorPositionId')}` : 'WHERE 1=0'}

        UNION ALL

        -- Caso recursivo: subordinados dos subordinados
        SELECT tms.subordinate_id
        FROM team_member_supervisors tms
        JOIN supervisor_subordinates ss ON tms.supervisor_id = ss.subordinate_id
      ),
      cancelled_reservations AS (
        SELECT
          sr.id,
          sr.user_id,
          sr.space_id,
          sr.closed_at,
          sr.slot_range,
          -- Calcula a quinta-feira da semana ANTERIOR à semana da reserva
          -- A semana vai de DOMINGO a SÁBADO (regra de negócio)
          -- Fórmula para obter o domingo da semana: DATE_TRUNC('week', slot + 1 day) - 1 day
          -- Prazo = quinta da semana anterior = domingo - 3 dias + 23:59:59
          (
            (DATE_TRUNC('week', (LOWER(sr.slot_range) AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day')
             - INTERVAL '1 day')
            - INTERVAL '3 days'
            + INTERVAL '23 hours 59 minutes 59 seconds'
          ) AS planning_deadline
        FROM space_reservations sr
        JOIN spaces s ON s.id = sr.space_id
        WHERE sr.status = 'closed'
          AND s.type = 'workstation'
          AND sr.closed_at IS NOT NULL
          AND sr.closed_at >= '${CANCELLED_RESERVATIONS_CUTOFF_DATE}'::date
          -- Exclui reservas que tiveram check-in (são check-outs normais, não cancelamentos)
          AND NOT EXISTS (
            SELECT 1 FROM space_check_in_out scio
            WHERE scio.reservation_id = sr.id
              AND scio.type = 'check-in'
          )
      )
      SELECT COUNT(*) as total
      FROM cancelled_reservations cr
      JOIN users u ON u.id = cr.user_id
      LEFT JOIN team_positions tp ON tp.user_id = cr.user_id
      WHERE cr.closed_at > cr.planning_deadline
        -- Filtrar usuários afastados: não incluir quem está de folga
        AND (
          u.absence_start_date IS NULL
          OR u.absence_end_date IS NULL
          OR CURRENT_DATE NOT BETWEEN u.absence_start_date AND u.absence_end_date
        )
        ${filters?.startDate ? 'AND cr.closed_at >= $1::timestamptz' : ''}
        ${filters?.endDate ? `AND cr.closed_at <= $${filters?.startDate ? '2' : '1'}::timestamptz` : ''}
        ${filters?.userName ? `AND u.name ILIKE $${this.getNextParamIndex(filters, 'userName')}` : ''}
        ${filters?.position ? `AND tp.position = $${this.getNextParamIndex(filters, 'position')}` : ''}
        ${filters?.supervisorPositionId ? 'AND tp.id IN (SELECT subordinate_id FROM supervisor_subordinates)' : ''}
    `

    const values = this.buildFilterValues(filters)

    const result = await database.query({
      text: baseQuery,
      values,
    })

    return Number(result.rows[0].total)
  }

  /**
   * Lista reservas de workstation encerradas após o prazo de planejamento
   */
  async listCancelledReservations(
    page: number = 1,
    pageSize: number = 10,
    filters?: CancelledReservationsFilters,
  ): Promise<PaginatedCancelledReservations> {
    const offset = (page - 1) * pageSize

    // Query para buscar os cancelamentos com todos os dados necessários
    // Usa CTE recursiva para encontrar o supervisor real (cargo = 'supervisor') na hierarquia
    // e também para buscar todos os subordinados quando há filtro por supervisor
    const baseQuery = `
      WITH RECURSIVE
      -- CTE para buscar subordinados do supervisor logado (quando há filtro)
      supervisor_subordinates AS (
        -- Caso base: subordinados diretos do supervisor
        SELECT tms.subordinate_id
        FROM team_member_supervisors tms
        ${filters?.supervisorPositionId ? `WHERE tms.supervisor_id = $${this.getNextParamIndex(filters, 'supervisorPositionId')}` : 'WHERE 1=0'}

        UNION ALL

        -- Caso recursivo: subordinados dos subordinados
        SELECT tms.subordinate_id
        FROM team_member_supervisors tms
        JOIN supervisor_subordinates ss ON tms.supervisor_id = ss.subordinate_id
      ),
      cancelled_reservations AS (
        SELECT
          sr.id,
          sr.user_id,
          sr.space_id,
          sr.closed_at,
          sr.slot_range,
          -- Calcula a quinta-feira da semana ANTERIOR à semana da reserva
          -- A semana vai de DOMINGO a SÁBADO (regra de negócio)
          -- Fórmula para obter o domingo da semana: DATE_TRUNC('week', slot + 1 day) - 1 day
          -- Prazo = quinta da semana anterior = domingo - 3 dias + 23:59:59
          (
            (DATE_TRUNC('week', (LOWER(sr.slot_range) AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day')
             - INTERVAL '1 day')
            - INTERVAL '3 days'
            + INTERVAL '23 hours 59 minutes 59 seconds'
          ) AS planning_deadline
        FROM space_reservations sr
        JOIN spaces s ON s.id = sr.space_id
        WHERE sr.status = 'closed'
          AND s.type = 'workstation'
          AND sr.closed_at IS NOT NULL
          AND sr.closed_at >= '${CANCELLED_RESERVATIONS_CUTOFF_DATE}'::date
          -- Exclui reservas que tiveram check-in (são check-outs normais, não cancelamentos)
          AND NOT EXISTS (
            SELECT 1 FROM space_check_in_out scio
            WHERE scio.reservation_id = sr.id
              AND scio.type = 'check-in'
          )
      ),
      -- CTE recursiva para encontrar o supervisor real (cargo = 'supervisor') na hierarquia
      hierarchy_chain AS (
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
        cr.id,
        cr.user_id,
        u.name as user_name,
        u.email as user_email,
        tp.position as user_position,
        rs.supervisor_user_id as supervisor_id,
        u_sup.name as supervisor_name,
        u_sup.email as supervisor_email,
        cr.space_id,
        s.name as space_name,
        LOWER(cr.slot_range) as slot_start,
        UPPER(cr.slot_range) as slot_end,
        cr.closed_at,
        cr.planning_deadline,
        COUNT(*) OVER() as total_count
      FROM cancelled_reservations cr
      JOIN users u ON u.id = cr.user_id
      JOIN spaces s ON s.id = cr.space_id
      LEFT JOIN team_positions tp ON tp.user_id = cr.user_id
      LEFT JOIN real_supervisors rs ON rs.original_position_id = tp.id
      LEFT JOIN users u_sup ON u_sup.id = rs.supervisor_user_id
      WHERE cr.closed_at > cr.planning_deadline
        -- Filtrar usuários afastados: não incluir quem está de folga
        AND (
          u.absence_start_date IS NULL
          OR u.absence_end_date IS NULL
          OR CURRENT_DATE NOT BETWEEN u.absence_start_date AND u.absence_end_date
        )
        ${filters?.startDate ? 'AND cr.closed_at >= $1::timestamp' : ''}
        ${filters?.endDate ? `AND cr.closed_at <= $${filters?.startDate ? '2' : '1'}::timestamp` : ''}
        ${filters?.userName ? `AND u.name ILIKE $${this.getNextParamIndex(filters, 'userName')}` : ''}
        ${filters?.supervisorName ? `AND u_sup.name ILIKE $${this.getNextParamIndex(filters, 'supervisorName')}` : ''}
        ${filters?.position ? `AND tp.position = $${this.getNextParamIndex(filters, 'position')}` : ''}
        ${filters?.supervisorPositionId ? 'AND tp.id IN (SELECT subordinate_id FROM supervisor_subordinates)' : ''}
      ORDER by cr.closed_at DESC
      LIMIT $${this.getNextParamIndex(filters, 'limit')}
      OFFSET $${this.getNextParamIndex(filters, 'offset')}
    `

    const values = [...this.buildFilterValues(filters), pageSize, offset]

    const result = await database.query({
      text: baseQuery,
      values,
    })

    if (result.rows.length === 0) {
      return {
        reservations: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      }
    }

    const totalCount = Number(result.rows[0].total_count)
    const totalPages = Math.ceil(totalCount / pageSize)

    const reservations: CancelledReservation[] = result.rows.map(
      (row: {
        id: string
        user_id: string
        user_name: string
        user_email: string
        user_position: string | null
        supervisor_id: string | null
        supervisor_name: string | null
        supervisor_email: string | null
        space_id: string
        space_name: string
        slot_start: Date
        slot_end: Date
        closed_at: Date
        planning_deadline: Date
      }) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        userPosition: row.user_position,
        supervisorId: row.supervisor_id,
        supervisorName: row.supervisor_name,
        supervisorEmail: row.supervisor_email,
        spaceId: row.space_id,
        spaceName: row.space_name,
        slotStart: row.slot_start.toISOString(),
        slotEnd: row.slot_end.toISOString(),
        closedAt: row.closed_at.toISOString(),
        planningDeadline: row.planning_deadline.toISOString(),
      }),
    )

    return {
      reservations,
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  /**
   * Helper para calcular o próximo índice de parâmetro na query
   */
  private getNextParamIndex(
    filters?: CancelledReservationsFilters,
    currentField?: string,
  ): number {
    let index = 1

    if (filters?.startDate) index++
    if (currentField === 'startDate') return index - 1

    if (filters?.endDate) index++
    if (currentField === 'endDate') return index - 1

    if (filters?.userName) index++
    if (currentField === 'userName') return index - 1

    if (filters?.supervisorName) index++
    if (currentField === 'supervisorName') return index - 1

    if (filters?.position) index++
    if (currentField === 'position') return index - 1

    if (filters?.supervisorPositionId) index++
    if (currentField === 'supervisorPositionId') return index - 1

    // limit e offset vêm depois de todos os filtros
    if (currentField === 'limit') return index
    if (currentField === 'offset') return index + 1

    return index
  }

  /**
   * Helper para construir o array de valores dos filtros
   */
  private buildFilterValues(filters?: CancelledReservationsFilters): unknown[] {
    const values: unknown[] = []

    if (filters?.startDate) values.push(filters.startDate)
    if (filters?.endDate) values.push(filters.endDate)
    if (filters?.userName) values.push(`%${filters.userName}%`)
    if (filters?.supervisorName) values.push(`%${filters.supervisorName}%`)
    if (filters?.position) values.push(filters.position)
    if (filters?.supervisorPositionId) values.push(filters.supervisorPositionId)

    return values
  }
}
