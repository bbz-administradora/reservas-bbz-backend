// src/repositories/pg/pg-outposts-repository.ts

import { database } from '@/infra/database'
import {
  IOutpostsRepository,
  Outpost,
  OutpostCreate,
  OutpostDb,
  OutpostFilters,
  OutpostUpdate,
  OutpostWithUser,
  PaginatedOutposts,
} from '../base/outposts-repository'

interface OutpostWithUserDb extends OutpostDb {
  user_name: string | null
  user_email: string
  user_position: string | null
}

export class PgOutpostsRepository implements IOutpostsRepository {
  /**
   * Mapeia um registro do banco (snake_case) para o formato da aplicação (camelCase)
   */
  private mapToOutpost(row: OutpostDb): Outpost {
    return {
      id: row.id,
      userId: row.user_id,
      clientName: row.client_name,
      clientAddress: row.client_address,
      startDate: row.start_date.toISOString().split('T')[0],
      endDate: row.end_date?.toISOString().split('T')[0] ?? null,
      weekdays: row.weekdays,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  /**
   * Mapeia um registro com dados do usuário
   */
  private mapToOutpostWithUser(row: OutpostWithUserDb): OutpostWithUser {
    return {
      ...this.mapToOutpost(row),
      userName: row.user_name,
      userEmail: row.user_email,
      userPosition: row.user_position,
    }
  }

  async create(outpost: OutpostCreate): Promise<Outpost> {
    const result = await database.query({
      text: `
        INSERT INTO user_outposts (
          user_id, client_name, client_address,
          start_date, end_date, weekdays, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      values: [
        outpost.userId,
        outpost.clientName,
        outpost.clientAddress,
        outpost.startDate,
        outpost.endDate ?? null,
        outpost.weekdays,
        outpost.createdBy,
      ],
    })

    return this.mapToOutpost(result.rows[0])
  }

  async findById(id: string): Promise<Outpost | null> {
    const result = await database.query({
      text: `SELECT * FROM user_outposts WHERE id = $1`,
      values: [id],
    })

    if (!result.rows[0]) return null
    return this.mapToOutpost(result.rows[0])
  }

  async findByIdWithUser(id: string): Promise<OutpostWithUser | null> {
    const result = await database.query({
      text: `
        SELECT
          uo.*,
          u.name as user_name,
          u.email as user_email,
          tp.position as user_position
        FROM user_outposts uo
        JOIN users u ON u.id = uo.user_id
        LEFT JOIN team_positions tp ON tp.user_id = uo.user_id
        WHERE uo.id = $1
      `,
      values: [id],
    })

    if (!result.rows[0]) return null
    return this.mapToOutpostWithUser(result.rows[0])
  }

  async list(
    page: number,
    limit: number,
    filters?: OutpostFilters,
  ): Promise<PaginatedOutposts> {
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const values: (string | string[])[] = []
    let paramIndex = 1

    // Filtro por status
    if (filters?.status === 'active') {
      conditions.push(
        `(uo.start_date <= CURRENT_DATE AND (uo.end_date IS NULL OR uo.end_date >= CURRENT_DATE))`,
      )
    } else if (filters?.status === 'ended') {
      conditions.push(
        `(uo.end_date IS NOT NULL AND uo.end_date < CURRENT_DATE)`,
      )
    }

    // Filtro por busca (nome ou email)
    if (filters?.search) {
      conditions.push(
        `(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`,
      )
      values.push(`%${filters.search}%`)
      paramIndex++
    }

    // Filtro por usuário específico
    if (filters?.userId) {
      conditions.push(`uo.user_id = $${paramIndex}`)
      values.push(filters.userId)
      paramIndex++
    }

    // Filtro por lista de usuários (supervisor vê apenas sua equipe)
    if (filters?.userIds && filters.userIds.length > 0) {
      conditions.push(`uo.user_id = ANY($${paramIndex}::uuid[])`)
      values.push(filters.userIds)
      paramIndex++
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Query de contagem
    const countResult = await database.query({
      text: `
        SELECT COUNT(*) as total
        FROM user_outposts uo
        JOIN users u ON u.id = uo.user_id
        ${whereClause}
      `,
      values,
    })

    const totalCount = parseInt(countResult.rows[0].total, 10)
    const totalPages = Math.ceil(totalCount / limit)

    // Query de dados
    const dataResult = await database.query({
      text: `
        SELECT
          uo.*,
          u.name as user_name,
          u.email as user_email,
          tp.position as user_position
        FROM user_outposts uo
        JOIN users u ON u.id = uo.user_id
        LEFT JOIN team_positions tp ON tp.user_id = uo.user_id
        ${whereClause}
        ORDER BY
          CASE WHEN uo.end_date IS NULL OR uo.end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
          uo.start_date DESC,
          u.name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      values: [...values, limit.toString(), offset.toString()],
    })

    return {
      outposts: dataResult.rows.map((row: OutpostWithUserDb) =>
        this.mapToOutpostWithUser(row),
      ),
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  async update(outpost: OutpostUpdate): Promise<Outpost> {
    const updates: string[] = []
    const values: (string | number[] | null)[] = []
    let paramIndex = 1

    if (outpost.clientName !== undefined) {
      updates.push(`client_name = $${paramIndex}`)
      values.push(outpost.clientName)
      paramIndex++
    }

    if (outpost.clientAddress !== undefined) {
      updates.push(`client_address = $${paramIndex}`)
      values.push(outpost.clientAddress)
      paramIndex++
    }

    if (outpost.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex}`)
      values.push(outpost.endDate)
      paramIndex++
    }

    if (outpost.weekdays !== undefined) {
      updates.push(`weekdays = $${paramIndex}`)
      values.push(outpost.weekdays)
      paramIndex++
    }

    updates.push(`updated_at = NOW()`)

    const result = await database.query({
      text: `
        UPDATE user_outposts
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
      values: [...values, outpost.id],
    })

    return this.mapToOutpost(result.rows[0])
  }

  async endOutpost(id: string): Promise<Outpost> {
    // Encerra setando end_date para ontem
    const result = await database.query({
      text: `
        UPDATE user_outposts
        SET end_date = CURRENT_DATE - INTERVAL '1 day', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      values: [id],
    })

    return this.mapToOutpost(result.rows[0])
  }

  async isUserOnOutpost(userId: string): Promise<boolean> {
    const result = await database.query({
      text: `
        SELECT EXISTS(
          SELECT 1 FROM user_outposts
          WHERE user_id = $1
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ) as is_on_outpost
      `,
      values: [userId],
    })

    return result.rows[0].is_on_outpost
  }

  async listActiveByUserId(userId: string): Promise<Outpost[]> {
    const result = await database.query({
      text: `
        SELECT * FROM user_outposts
        WHERE user_id = $1
        AND start_date <= CURRENT_DATE
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY start_date DESC
      `,
      values: [userId],
    })

    return result.rows.map((row: OutpostDb) => this.mapToOutpost(row))
  }
}
