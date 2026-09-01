// pg-verification-token-repository.ts

import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  IVerificationTokenRepository,
  VerificationToken,
  VerificationTokenCreate,
  VerificationTokenDb,
  VerificationTokenType,
  VerificationTokenUpdate,
} from '../base/verification-tokens-repository'

export class PgVerificationTokenRepository implements IVerificationTokenRepository {
  async create(data: VerificationTokenCreate): Promise<VerificationToken> {
    const { userId, tokenType, expires } = data

    if (!userId || !tokenType || !expires) {
      throw new BadRequestError({
        message:
          'ID do usuário, tipo de token e data de expiração são obrigatórios para criar o token de verificação.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const query = `
      INSERT INTO verification_tokens (user_id, token_type, expires)
      VALUES ($1, $2, $3)
      RETURNING *
    `

    const result = await database.query({
      text: query,
      values: [userId, tokenType, expires],
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message:
          'Falha ao criar o token de verificação no repositório pg-verification-token-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToVerificationToken(result.rows[0])
  }

  async update(data: VerificationTokenUpdate): Promise<VerificationToken> {
    if (!data.userId || !data.tokenType) {
      throw new BadRequestError({
        message:
          'ID do usuário e tipo de token são obrigatórios para atualizar o token de verificação.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const { columns, values } = this.mapToDbColumns(data, true)

    if (columns.length === 0) {
      throw new BadRequestError({
        message:
          'Nenhum campo válido foi fornecido para atualizar o token de verificação.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    // Adiciona userId e tokenType como condições de WHERE
    values.push(data.userId, data.tokenType)

    const query = `
      UPDATE verification_tokens
      SET ${columns.join(', ')}, updated_at = now() at time zone 'utc'
      WHERE user_id = $${values.length - 1} AND token_type = $${values.length}
      RETURNING *
    `

    const result = await database.query({
      text: query,
      values,
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message:
          'Falha ao atualizar o token de verificação no repositório pg-verification-token-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToVerificationToken(result.rows[0])
  }

  async findTokenByTypeAndUserId(
    userId: string,
    tokenType: string,
  ): Promise<VerificationToken | null> {
    if (!userId || !tokenType) {
      throw new BadRequestError({
        message:
          'ID do usuário e tipo de token são obrigatórios para buscar o token de verificação.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const query = `
      SELECT *
      FROM verification_tokens
      WHERE user_id = $1 AND token_type = $2
    `

    const result = await database.query({
      text: query,
      values: [userId, tokenType],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToVerificationToken(result.rows[0])
  }

  async findTokensByTypeAndUserId(
    userId: string,
    tokenType: string,
  ): Promise<VerificationToken[]> {
    if (!userId || !tokenType) {
      throw new BadRequestError({
        message:
          'ID do usuário e tipo de token são obrigatórios para buscar os tokens de verificação.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const query = `
      SELECT *
      FROM verification_tokens
      WHERE user_id = $1 AND token_type = $2
    `

    const result = await database.query({
      text: query,
      values: [userId, tokenType],
    })

    // Retorna um array vazio se não houver tokens
    return result.rows.length > 0
      ? result.rows.map((row: VerificationTokenDb) =>
          this.mapToVerificationToken(row),
        )
      : []
  }

  async findValidTokenByToken(
    token: string,
  ): Promise<VerificationToken | null> {
    if (!token) {
      throw new BadRequestError({
        message: 'Token é obrigatório para buscar o token de verificação.',
        action: 'Forneça um token válido e tente novamente.',
      })
    }

    const query = `
      SELECT *
      FROM verification_tokens
      WHERE token = $1 AND expires > now() at time zone 'utc'
    `

    const result = await database.query({
      text: query,
      values: [token],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToVerificationToken(result.rows[0])
  }

  async findValidTokenByOpt(opt: string): Promise<VerificationToken | null> {
    if (!opt) {
      throw new BadRequestError({
        message: 'OPT é obrigatório para buscar o token de verificação.',
        action: 'Forneça um OPT válido e tente novamente.',
      })
    }

    const query = `
        SELECT *
        FROM verification_tokens
        WHERE opt = $1 AND expires > now() at time zone 'utc'
      `

    const result = await database.query({
      text: query,
      values: [opt],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToVerificationToken(result.rows[0])
  }

  async deleteByToken(token: string): Promise<void> {
    if (!token) {
      throw new BadRequestError({
        message: 'Token é obrigatório para deletar o token de verificação.',
        action: 'Forneça um token válido e tente novamente.',
      })
    }

    const query = `
      DELETE FROM verification_tokens
      WHERE token = $1
    `

    await database.query({
      text: query,
      values: [token],
    })
  }

  private mapToDbColumns(
    data: Partial<VerificationTokenUpdate>,
    isUpdate = false,
  ) {
    const fields = Object.entries(data).filter(
      ([, value]) => value !== undefined,
    )
    const columns = fields.map(([key], index) =>
      isUpdate
        ? `${this.toSnakeCase(key)} = $${index + 1}`
        : this.toSnakeCase(key),
    )
    const values = fields.map(([, value]) => value)

    return { columns, values }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  private mapToVerificationToken(row: VerificationTokenDb): VerificationToken {
    return {
      userId: row.user_id,
      token: row.token,
      tokenType: row.token_type as VerificationTokenType,
      expires: row.expires,
      opt: row.opt,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
