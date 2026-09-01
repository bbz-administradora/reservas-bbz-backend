import { database } from '@/infra/database'
import {
  BadRequestError,
  DatabaseError,
  UnprocessableEntityError,
} from '@/infra/errors'
import {
  Account,
  AccountCreate,
  AccountDb,
  AccountUpdate,
  IAccountRepository,
} from '../base/accounts-repository'

export class PgAccountsRepository implements IAccountRepository {
  async create(account: AccountCreate): Promise<Account> {
    if (!account.userId || !account.provider || !account.providerAccountId) {
      throw new BadRequestError({
        message:
          'ID do usuário, provedor e ID da conta do provedor são obrigatórios para criar a conta.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const { columns, placeholders, values } = this.mapToDbColumns(account)

    if (columns.length === 0) {
      throw new UnprocessableEntityError({
        message: 'Nenhum campo válido foi fornecido para criar a conta.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    const queryText = `
      INSERT INTO accounts (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values,
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message:
          'Falha ao criar a conta no repositório pg-accounts-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToAccount(result.rows[0])
  }

  async update(account: AccountUpdate): Promise<Account> {
    if (!account.id) {
      throw new BadRequestError({
        message: 'O ID da conta é obrigatório para atualizar a conta.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }
    const { columns, placeholders, values } = this.mapToDbColumns(account, true)

    if (columns.length === 0) {
      throw new BadRequestError({
        message: 'Nenhum campo válido foi fornecido para atualizar a conta.',
        action: 'Verifique os dados enviados e tente novamente.',
      })
    }

    values.push(account.id)

    const queryText = `
      UPDATE accounts
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
          'Falha ao atualizar a conta no repositório pg-accounts-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToAccount(result.rows[0])
  }

  async deleteAllAccountsByUserId(userId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestError({
        message: 'O ID do usuário é obrigatório para excluir as contas.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }

    await database.query({
      text: `
        DELETE FROM accounts
        WHERE user_id = $1
      `,
      values: [userId],
    })
  }

  async findAllAccountsByUserId(userId: string): Promise<Account[]> {
    if (!userId) {
      throw new BadRequestError({
        message: 'O ID do usuário é obrigatório para buscar as contas.',
        action: 'Forneça um ID válido e tente novamente.',
      })
    }
    const result = await database.query({
      text: `
        SELECT *
        FROM accounts
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      values: [userId],
    })
    if (!result.rows[0]) {
      return []
    }
    return result.rows.map((row: AccountDb) => this.mapToAccount(row))
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: string,
  ): Promise<Account | null> {
    const result = await database.query({
      text: `
        SELECT *
        FROM accounts
        WHERE user_id = $1 AND provider = $2
        LIMIT 1
      `,
      values: [userId, provider],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToAccount(result.rows[0])
  }

  private mapToDbColumns(data: Partial<AccountCreate>, isUpdate = false) {
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

  async findByProvider(provider: string): Promise<Account | null> {
    if (!provider) {
      throw new BadRequestError({
        message: 'O provedor é obrigatório para buscar a conta.',
        action: 'Forneça um provedor válido e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT *
        FROM accounts
        WHERE provider = $1
        LIMIT 1
      `,
      values: [provider],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToAccount(result.rows[0])
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }

  private mapToAccount(row: AccountDb): Account {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      provider: row.provider,
      providerAccountId: row.provider_account_id,
      refreshToken: row.refresh_token,
      accessToken: row.access_token,
      expiresAt: row.expires_at,
      tokenType: row.token_type,
      scope: row.scope,
      idToken: row.id_token,
      sessionState: row.session_state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
