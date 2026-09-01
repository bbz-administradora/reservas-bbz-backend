// src/repositories/pg/pg-user-monitoring-repository.ts
import { database } from '@/infra/database'
import { DatabaseError } from '@/infra/errors'

// ========================================
// 📌 INTERFACES
// ========================================

export interface UserMonitoring {
  id: string
  userId: string
  userEmail?: string
  userName?: string
  isActive: boolean
  reason?: string
  createdAt: string
  updatedAt: string
}

export interface UserMonitoringLog {
  id: string
  userId: string
  userEmail?: string
  userName?: string
  method: string
  url: string
  statusCode?: number
  requestBody?: unknown
  responseBody?: unknown
  errorName?: string
  errorMessage?: string
  errorDetails?: unknown
  durationMs?: number
  ip?: string
  userAgent?: string
  createdAt: string
}

export interface CreateMonitoringLogInput {
  userId: string
  userEmail?: string
  userName?: string
  method: string
  url: string
  statusCode?: number
  requestBody?: unknown
  responseBody?: unknown
  errorName?: string
  errorMessage?: string
  errorDetails?: unknown
  durationMs?: number
  ip?: string
  userAgent?: string
}

export interface CreateUserMonitoringInput {
  userId: string
  reason?: string
  isActive?: boolean
}

// ========================================
// 📌 REPOSITÓRIO
// ========================================

export class PgUserMonitoringRepository {
  /**
   * Verifica se um usuário está sendo monitorado ativamente
   */
  async isUserMonitored(userId: string): Promise<boolean> {
    const query = {
      text: `
        SELECT EXISTS(
          SELECT 1 FROM user_monitoring
          WHERE user_id = $1 AND is_active = true
        ) as is_monitored
      `,
      values: [userId],
    }

    const result = await database.query(query)
    return result.rows[0]?.is_monitored ?? false
  }

  /**
   * Ativa monitoramento para um usuário
   */
  async activateMonitoring(
    input: CreateUserMonitoringInput,
  ): Promise<UserMonitoring> {
    const query = {
      text: `
        INSERT INTO user_monitoring (user_id, reason, is_active)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id)
        DO UPDATE SET
          is_active = true,
          reason = COALESCE(EXCLUDED.reason, user_monitoring.reason),
          updated_at = (now() at time zone 'utc')
        RETURNING
          id,
          user_id,
          is_active,
          reason,
          created_at,
          updated_at
      `,
      values: [input.userId, input.reason ?? null, input.isActive ?? true],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao ativar monitoramento',
        action: 'Verifique os dados e tente novamente',
      })
    }

    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      isActive: row.is_active,
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  /**
   * Desativa monitoramento para um usuário
   */
  async deactivateMonitoring(userId: string): Promise<void> {
    const query = {
      text: `
        UPDATE user_monitoring
        SET is_active = false, updated_at = (now() at time zone 'utc')
        WHERE user_id = $1
      `,
      values: [userId],
    }

    await database.query(query)
  }

  /**
   * Lista todos os usuários sendo monitorados
   */
  async listMonitoredUsers(onlyActive = true): Promise<UserMonitoring[]> {
    const query = {
      text: `
        SELECT
          um.id,
          um.user_id,
          um.is_active,
          um.reason,
          um.created_at,
          um.updated_at,
          u.email as user_email,
          u.name as user_name
        FROM user_monitoring um
        LEFT JOIN users u ON u.id = um.user_id
        ${onlyActive ? 'WHERE um.is_active = true' : ''}
        ORDER BY um.created_at DESC
      `,
      values: [],
    }

    const result = await database.query(query)

    return result.rows.map((row: Record<string, any>) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      isActive: row.is_active,
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }))
  }

  /**
   * Registra um log de requisição para um usuário monitorado
   */
  async createLog(input: CreateMonitoringLogInput): Promise<UserMonitoringLog> {
    // Limita o tamanho do response_body para não estourar o banco
    let responseBody = input.responseBody
    if (responseBody) {
      const responseStr = JSON.stringify(responseBody)
      if (responseStr.length > 10000) {
        responseBody = {
          _truncated: true,
          _originalSize: responseStr.length,
          _message:
            'Response body muito grande, truncado para economizar espaço',
        }
      }
    }

    const query = {
      text: `
        INSERT INTO user_monitoring_logs (
          user_id,
          user_email,
          user_name,
          method,
          url,
          status_code,
          request_body,
          response_body,
          error_name,
          error_message,
          error_details,
          duration_ms,
          ip,
          user_agent
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING
          id,
          user_id,
          user_email,
          user_name,
          method,
          url,
          status_code,
          request_body,
          response_body,
          error_name,
          error_message,
          error_details,
          duration_ms,
          ip,
          user_agent,
          created_at
      `,
      values: [
        input.userId,
        input.userEmail ?? null,
        input.userName ?? null,
        input.method,
        input.url,
        input.statusCode ?? null,
        input.requestBody ? JSON.stringify(input.requestBody) : null,
        responseBody ? JSON.stringify(responseBody) : null,
        input.errorName ?? null,
        input.errorMessage ?? null,
        input.errorDetails ? JSON.stringify(input.errorDetails) : null,
        input.durationMs ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    }

    const result = await database.query(query)

    if (!result.rows[0]) {
      throw new DatabaseError({
        message: 'Falha ao registrar log de monitoramento',
        action: 'Verifique os dados e tente novamente',
      })
    }

    const row = result.rows[0]
    return this.mapLogRow(row)
  }

  /**
   * Busca logs de um usuário específico
   */
  async getLogsByUserId(
    userId: string,
    options?: {
      limit?: number
      offset?: number
      startDate?: string
      endDate?: string
      onlyErrors?: boolean
    },
  ): Promise<UserMonitoringLog[]> {
    const conditions = ['user_id = $1']
    const values: unknown[] = [userId]
    let paramIndex = 2

    if (options?.startDate) {
      conditions.push(`created_at >= $${paramIndex}`)
      values.push(options.startDate)
      paramIndex++
    }

    if (options?.endDate) {
      conditions.push(`created_at <= $${paramIndex}`)
      values.push(options.endDate)
      paramIndex++
    }

    if (options?.onlyErrors) {
      conditions.push(`(error_name IS NOT NULL OR status_code >= 400)`)
    }

    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0

    const query = {
      text: `
        SELECT
          id,
          user_id,
          user_email,
          user_name,
          method,
          url,
          status_code,
          request_body,
          response_body,
          error_name,
          error_message,
          error_details,
          duration_ms,
          ip,
          user_agent,
          created_at
        FROM user_monitoring_logs
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      values,
    }

    const result = await database.query(query)
    return result.rows.map((row: Record<string, any>) => this.mapLogRow(row))
  }

  /**
   * Conta total de logs de um usuário
   */
  async countLogsByUserId(
    userId: string,
    options?: {
      startDate?: string
      endDate?: string
      onlyErrors?: boolean
    },
  ): Promise<number> {
    const conditions = ['user_id = $1']
    const values: unknown[] = [userId]
    let paramIndex = 2

    if (options?.startDate) {
      conditions.push(`created_at >= $${paramIndex}`)
      values.push(options.startDate)
      paramIndex++
    }

    if (options?.endDate) {
      conditions.push(`created_at <= $${paramIndex}`)
      values.push(options.endDate)
      paramIndex++
    }

    if (options?.onlyErrors) {
      conditions.push(`(error_name IS NOT NULL OR status_code >= 400)`)
    }

    const query = {
      text: `
        SELECT COUNT(*) as total
        FROM user_monitoring_logs
        WHERE ${conditions.join(' AND ')}
      `,
      values,
    }

    const result = await database.query(query)
    return parseInt(result.rows[0]?.total ?? '0', 10)
  }

  /**
   * Deleta logs antigos (para limpeza)
   */
  async deleteOldLogs(daysToKeep = 30): Promise<number> {
    const query = {
      text: `
        DELETE FROM user_monitoring_logs
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING id
      `,
      values: [],
    }

    const result = await database.query(query)
    return result.rowCount ?? 0
  }

  /**
   * Mapeia uma row do banco para o objeto UserMonitoringLog
   */
  private mapLogRow(row: any): UserMonitoringLog {
    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      method: row.method,
      url: row.url,
      statusCode: row.status_code,
      requestBody: row.request_body,
      responseBody: row.response_body,
      errorName: row.error_name,
      errorMessage: row.error_message,
      errorDetails: row.error_details,
      durationMs: row.duration_ms,
      ip: row.ip,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
    }
  }
}
