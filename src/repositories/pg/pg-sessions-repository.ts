import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  ISessionRepository,
  Session,
  SessionCreate,
  SessionDb,
  SessionUpdate,
} from '../base/sessions-repository'

export class PgSessionsRepository implements ISessionRepository {
  async create(session: SessionCreate): Promise<Session> {
    if (!session.userId || !session.expires || !session.sessionId) {
      throw new BadRequestError({
        message: 'sessionId, userId e expires são obrigatórios',
        action: 'Forneça todos os campos obrigatórios e tente novamente',
      })
    }

    const { columns, placeholders, values } = this.mapToDbColumns(session)

    if (columns.length === 0) {
      throw new BadRequestError({
        message: 'Nenhum campo válido fornecido',
        action: 'Forneça pelo menos um campo válido para criação',
      })
    }

    const queryText = `
      INSERT INTO sessions (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `

    try {
      const result = await database.query({
        text: queryText,
        values,
      })

      if (!result.rows[0]) {
        throw new DatabaseError({
          message: 'Falha ao criar sessão',
          action: 'Verifique os logs do servidor para mais detalhes',
        })
      }

      return this.mapToSession(result.rows[0])
    } catch (error) {
      if (error instanceof BadRequestError) throw error
      const errMsg = error instanceof Error ? error.message : String(error)

      throw new DatabaseError({
        message: `Erro ao criar sessão: ${errMsg}`,
        action: 'Verifique a conexão com o banco e os logs do servidor',
        details: error,
      })
    }
  }

  async update(session: SessionUpdate): Promise<Session> {
    if (!session.sessionId) {
      throw new BadRequestError({
        message: 'sessionId é obrigatório para atualização',
        action: 'Forneça o sessionId da sessão que deseja atualizar',
      })
    }

    const { columns, values } = this.mapToDbColumns(session, true)

    if (columns.length === 0) {
      throw new BadRequestError({
        message: 'Nenhum campo válido para atualização',
        action: 'Forneça pelo menos um campo válido para atualizar',
      })
    }

    const setClause = columns
      .map((col, index) => `${col} = $${index + 1}`)
      .join(', ')

    const queryText = `
      UPDATE sessions
      SET ${setClause}
      WHERE session_id = $${values.length + 1}
      RETURNING *
    `

    values.push(session.sessionId)

    try {
      const result = await database.query({
        text: queryText,
        values,
      })

      if (!result.rows[0]) {
        throw new DatabaseError({
          message: `Sessão com ID ${session.sessionId} não encontrada`,
          action: 'Verifique se o ID fornecido está correto',
        })
      }

      return this.mapToSession(result.rows[0])
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof DatabaseError) {
        throw error
      }
      const errMsg = error instanceof Error ? error.message : String(error)

      throw new DatabaseError({
        message: `Erro ao atualizar sessão: ${errMsg}`,
        action: 'Verifique a conexão com o banco e os logs do servidor',
        details: error,
      })
    }
  }

  async deleteById(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new BadRequestError({
        message:
          'ID inválido para deletar a sessão no método deleteById do repositório pg-sessions-repository.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    const query = `
      DELETE FROM sessions
      WHERE session_id = $1
    `

    await database.query({
      text: query,
      values: [sessionId],
    })
  }

  async findById(sessionId: string): Promise<Session | null> {
    if (!sessionId) {
      return null
    }

    const query = `
      SELECT *
      FROM sessions
      WHERE session_id = $1
      LIMIT 1
    `

    const result = await database.query({
      text: query,
      values: [sessionId],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToSession(result.rows[0])
  }

  async deleteAllSessionsByUserId(userId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestError({
        message:
          'ID de usuário inválido para deletar sessões no método deleteAllSessionsByUserId do repositório pg-sessions-repository.',
        action: 'Forneça um ID de usuário válido e tente novamente.',
      })
    }

    const query = `
      DELETE FROM sessions
      WHERE user_id = $1
    `
    await database.query({
      text: query,
      values: [userId],
    })
  }

  async deleteAllExpiredSessionsByUserId(userId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestError({
        message:
          'ID de usuário inválido para deletar sessões expiradas no método deleteAllExpiredSessionsByUserId do repositório pg-sessions-repository.',
        action: 'Forneça um ID de usuário válido e tente novamente.',
      })
    }

    const query = `
      DELETE FROM sessions
      WHERE user_id = $1
        AND expires < now() at time zone 'utc'
    `

    await database.query({
      text: query,
      values: [userId],
    })
  }

  async deleteSessionBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    if (!sessionId || !userId) {
      throw new BadRequestError({
        message: 'sessionId e userId são obrigatórios para deletar a sessão.',
        action: 'Forneça ambos os parâmetros e tente novamente.',
      })
    }

    const query = `
      DELETE FROM sessions
      WHERE session_id = $1
        AND user_id = $2
    `

    await database.query({
      text: query,
      values: [sessionId, userId],
    })
  }

  async findSessionsByUserId(userId: string): Promise<Session[]> {
    if (!userId) {
      return []
    }

    const query = `
      SELECT *
      FROM sessions
      WHERE user_id = $1
    `

    const result = await database.query({
      text: query,
      values: [userId],
    })

    return result.rows.map((row: SessionDb) => this.mapToSession(row))
  }

  async checkValidSessionWithIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    if (!sessionId || !userId) {
      return null
    }

    const query = `
      SELECT *
      FROM sessions
      WHERE session_id = $1
        AND user_id = $2
        AND expires > now() at time zone 'utc'
      LIMIT 1
    `

    const result = await database.query({
      text: query,
      values: [sessionId, userId],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToSession(result.rows[0])
  }

  private mapToDbColumns(
    data: Partial<SessionCreate>,
    isUpdate: boolean = false,
  ) {
    // Filtra campos que não devem ser incluídos
    const excludeFields = isUpdate ? ['sessionId'] : []

    const fields = Object.entries(data).filter(
      ([key, value]) => value !== undefined && !excludeFields.includes(key),
    )
    const columns = fields.map(([key]) => this.toSnakeCase(key))
    const placeholders = fields.map((_, index) => `$${index + 1}`)
    const values = fields.map(([, value]) => value)

    return { columns, placeholders, values }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  private mapToSession(row: SessionDb): Session {
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      expires: row.expires,
      rememberMe: row.remember_me,
      createdAt: row.created_at,
    }
  }
}
