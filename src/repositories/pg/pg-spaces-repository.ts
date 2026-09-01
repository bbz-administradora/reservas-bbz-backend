// src/repositories/pg/pg-spaces-repository.ts

import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  ISpaceRepository,
  PaginatedSpaces,
  Space,
  SpaceCreate,
  SpaceDb,
  SpaceFilters,
  SpaceUpdate,
} from '../base/spaces-repository'

export class PgSpacesRepository implements ISpaceRepository {
  async create(space: SpaceCreate): Promise<Space> {
    if (
      !space.name ||
      !space.capacidade ||
      space.capacidade <= 0 ||
      !space.userId
    ) {
      throw new BadRequestError({
        message:
          'O nome, capacidade e ID do usuário são obrigatórios para criar o espaço no repositório pg-spaces-repository.',
        action: 'Forneça valores válidos e tente novamente.',
      })
    }

    // Mapeia as colunas para snake_case
    const { columns, placeholders, values } = this.mapToDbColumns(space)

    if (columns.length === 0) {
      throw new BadRequestError({
        message:
          'Nenhum campo válido foi fornecido para criar o espaço no repositório pg-spaces-repository.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const queryText = `
      INSERT INTO spaces (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values,
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao criar o espaço no repositório pg-spaces-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToSpace(result.rows[0])
  }

  async update(space: SpaceUpdate): Promise<Space> {
    if (!space.id) {
      throw new BadRequestError({
        message:
          'O ID do espaço é obrigatório para atualizar o espaço no repositório pg-spaces-repository.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    const { columns, placeholders, values } = this.mapToDbColumns(space, true)

    if (columns.length === 0) {
      throw new BadRequestError({
        message:
          'Nenhum campo válido foi fornecido para atualizar o espaço no repositório pg-spaces-repository.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    values.push(space.id)

    const queryText = `
      UPDATE spaces
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
          'Falha ao atualizar o espaço no repositório pg-spaces-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToSpace(result.rows[0])
  }

  async findById(id: string): Promise<Space | null> {
    const result = await database.query({
      text: `
        SELECT s.*,
               u.name as user_name
        FROM spaces s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = $1
        LIMIT 1
      `,
      values: [id],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToSpace(result.rows[0])
  }

  async findByName(name: string): Promise<Space | null> {
    if (!name) {
      throw new BadRequestError({
        message:
          'O nome do espaço é obrigatório para buscar o espaço no repositório pg-spaces-repository.',
        action: 'Forneça um nome válido e tente novamente.',
      })
    }
    const result = await database.query({
      text: `
        SELECT s.*,
               u.name as user_name
        FROM spaces s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE LOWER(s.name) = LOWER($1)
        LIMIT 1
      `,
      values: [name],
    })
    if (!result.rows[0]) {
      return null
    }
    return this.mapToSpace(result.rows[0])
  }

  async deleteById(id: string): Promise<void> {
    if (!id) {
      throw new BadRequestError({
        message:
          'O ID do espaço é obrigatório para deletar o espaço no repositório pg-spaces-repository.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    // Hard delete: remove completamente o registro
    await database.query({
      text: `
        DELETE FROM spaces
        WHERE id = $1
      `,
      values: [id],
    })
  }

  async listSpaces(
    filters: SpaceFilters = {},
    page = 1,
    pageSize = 1000,
  ): Promise<PaginatedSpaces> {
    // build dynamic WHERE clauses
    const whereClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    // Não é mais necessário filtrar por deleted_at, pois o hard delete remove o registro

    // filter by name or description
    if (filters.searchTerm) {
      whereClauses.push(`(s.name ILIKE $${idx} OR s.description ILIKE $${idx})`)
      values.push(`%${filters.searchTerm}%`)
      idx++
    }

    // filter by active status
    if (filters.isActive !== undefined) {
      whereClauses.push(`s.is_active = $${idx}`)
      values.push(filters.isActive)
      idx++
    }

    // filter by minimum capacity
    if (filters.capacidade !== undefined) {
      whereClauses.push(`s.capacidade >= $${idx}`)
      values.push(filters.capacidade)
      idx++
    }

    // filter by type
    if (filters.type !== undefined) {
      whereClauses.push(`s.type = $${idx}`)
      values.push(filters.type)
      idx++
    }

    // filter by floor
    if (filters.floor !== undefined) {
      whereClauses.push(`s.floor = $${idx}`)
      values.push(filters.floor)
      idx++
    }

    // filter by zone
    if (filters.zone !== undefined) {
      whereClauses.push(`s.zone = $${idx}`)
      values.push(filters.zone)
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
        s.id,
        s.user_id,
        s.name,
        s.description,
        s.recursos,
        s.imagens,
        s.capacidade,
        s.type,
        s.floor,
        s.zone,
        s.position,
        s.qrcode_url,
        s.is_active,
        s.created_at,
        s.updated_at,
        u.name as user_name,
        COUNT(*) OVER() AS total_count
      FROM spaces s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereSql}
      ORDER BY s.name ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `

    const result = await database.query({ text: queryText, values })
    const rows = result.rows as Array<SpaceDb & { total_count: string }>

    const totalCount = rows.length ? parseInt(rows[0].total_count, 10) : 0
    const totalPages = Math.ceil(totalCount / pageSize)

    const spaces: Space[] = rows.map((row) => this.mapToSpace(row))

    return {
      spaces,
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  async updateQrcodeUrl(spaceId: string, qrcodeUrl: string): Promise<Space> {
    if (!spaceId) {
      throw new BadRequestError({
        message:
          'O ID do espaço é obrigatório para atualizar o QR code no repositório pg-spaces-repository.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    if (!qrcodeUrl) {
      throw new BadRequestError({
        message:
          'A URL do QR code é obrigatória para atualizar o QR code no repositório pg-spaces-repository.',
        action: 'Forneça uma URL válida e tente novamente.',
      })
    }

    const queryText = `
      UPDATE spaces
      SET qrcode_url = $1, updated_at = now() at time zone 'utc'
      WHERE id = $2
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values: [qrcodeUrl, spaceId],
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message:
          'Falha ao atualizar o QR code do espaço no repositório pg-spaces-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToSpace(result.rows[0])
  }

  private mapToDbColumns(data: Partial<SpaceCreate>, isUpdate = false) {
    // Filtra campos definidos
    const fields = Object.entries(data).filter(
      ([, value]) => value !== undefined,
    )

    // Monta lista de colunas (snake_case) e placeholders
    const columns = fields.map(([key], idx) =>
      isUpdate
        ? `${this.toSnakeCase(key)} = $${idx + 1}`
        : this.toSnakeCase(key),
    )
    const placeholders = fields.map((_, idx) => `$${idx + 1}`)

    // Prepara os valores, serializando os arrays para JSON
    const values = fields.map(([key, value]) => {
      const column = this.toSnakeCase(key)
      if (column === 'recursos' || column === 'imagens') {
        return JSON.stringify(value as string[])
      }
      return value
    })

    return { columns, placeholders, values }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  private mapToSpace(row: SpaceDb): Space {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      recursos: row.recursos,
      imagens: row.imagens,
      capacidade: row.capacidade,
      type: row.type || 'room',
      floor: row.floor,
      zone: row.zone,
      position: row.position,
      qrcodeUrl: row.qrcode_url,
      isActive: row.is_active,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      userName: row.user_name,
    }
  }
}
