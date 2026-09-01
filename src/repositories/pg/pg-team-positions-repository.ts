// src/repositories/pg/pg-team-positions-repository.ts

import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  ITeamPositionsRepository,
  OrganogramMemberDb,
  POSITION_LEVELS,
  TeamPosition,
  TeamPositionCreate,
  TeamPositionDb,
  TeamPositionType,
  TeamPositionWithUser,
} from '../base/team-positions-repository'

/**
 * Implementação PostgreSQL do repositório de posições da equipe
 *
 * Este repositório gerencia as operações de CRUD para a tabela team_positions,
 * permitindo a nomeação e remoção de gerentes, supervisores e membros da
 * equipe de atendimento.
 */
export class PgTeamPositionsRepository implements ITeamPositionsRepository {
  /**
   * Cria uma nova posição para um usuário
   *
   * @param data Dados da posição (userId, position, assignedBy)
   * @returns A posição criada
   * @throws BadRequestError se userId não for fornecido
   * @throws DatabaseError se falhar ao criar a posição
   *
   * @example
   * // Nomear um gerente
   * const position = await repository.create({
   *   userId: 'uuid-do-usuario',
   *   position: 'manager',
   *   assignedBy: 'uuid-do-supervisor',
   *   supervisorPositionId: 'uuid-da-posicao-do-chefe' // opcional
   * })
   */
  async create(data: TeamPositionCreate): Promise<TeamPosition> {
    if (!data.userId) {
      throw new BadRequestError({
        message:
          'O ID do usuário é obrigatório para criar uma posição no repositório pg-team-positions-repository.',
        action: 'Forneça um ID de usuário válido e tente novamente.',
      })
    }

    if (!data.assignedBy) {
      throw new BadRequestError({
        message:
          'O ID de quem está nomeando é obrigatório para criar uma posição no repositório pg-team-positions-repository.',
        action:
          'Forneça o ID do usuário que está fazendo a nomeação e tente novamente.',
      })
    }

    // Obtém o level baseado na position
    const level = POSITION_LEVELS[data.position]

    const queryText = `
      INSERT INTO team_positions (user_id, position, level, assigned_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values: [data.userId, data.position, level, data.assignedBy],
    })

    if (!result.rows[0]) {
      throw new DatabaseError({
        message:
          'Falha ao criar a posição no repositório pg-team-positions-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    const createdPosition = this.mapToTeamPosition(result.rows[0])

    // 📌 Cria o vínculo hierárquico com o chefe imediato (se informado)
    // O supervisorPositionId é o ID da posição do chefe imediato na tabela team_positions
    if (data.supervisorPositionId) {
      try {
        // Primeiro remove qualquer vínculo existente do subordinado (por segurança)
        await database.query({
          text: `DELETE FROM team_member_supervisors WHERE subordinate_id = $1`,
          values: [createdPosition.id],
        })
        // Depois insere o novo vínculo com o chefe informado
        await database.query({
          text: `
            INSERT INTO team_member_supervisors (subordinate_id, supervisor_id)
            VALUES ($1, $2)
          `,
          values: [createdPosition.id, data.supervisorPositionId],
        })
      } catch {
        // Se falhar ao criar o vínculo, não impede a criação da posição
        // O vínculo pode ser estabelecido posteriormente
      }
    }

    return createdPosition
  }

  /**
   * Remove a posição de um usuário pelo user_id
   *
   * @param userId ID do usuário que terá a posição removida
   * @throws BadRequestError se userId não for fornecido
   *
   * @example
   * // Remover posição de um gerente
   * await repository.deleteByUserId('uuid-do-usuario')
   */
  async deleteByUserId(userId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestError({
        message:
          'O ID do usuário é obrigatório para remover uma posição no repositório pg-team-positions-repository.',
        action: 'Forneça um ID de usuário válido e tente novamente.',
      })
    }

    await database.query({
      text: `
        DELETE FROM team_positions
        WHERE user_id = $1
      `,
      values: [userId],
    })
  }

  /**
   * Busca a posição de um usuário pelo user_id
   *
   * @param userId ID do usuário
   * @returns A posição encontrada ou null se não existir
   *
   * @example
   * // Verificar se usuário já tem posição
   * const position = await repository.findByUserId('uuid-do-usuario')
   * if (position) {
   *   console.log(`Usuário já é ${position.position}`)
   * }
   */
  async findByUserId(userId: string): Promise<TeamPosition | null> {
    if (!userId) {
      throw new BadRequestError({
        message:
          'O ID do usuário é obrigatório para buscar uma posição no repositório pg-team-positions-repository.',
        action: 'Forneça um ID de usuário válido e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT *
        FROM team_positions
        WHERE user_id = $1
        LIMIT 1
      `,
      values: [userId],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToTeamPosition(result.rows[0])
  }

  /**
   * Busca a posição de um usuário pelo user_id com dados do usuário e de quem nomeou
   *
   * @param userId ID do usuário
   * @returns A posição com dados do usuário ou null se não existir
   *
   * @example
   * // Buscar posição com dados do usuário
   * const position = await repository.findByUserIdWithUser('uuid-do-usuario')
   * if (position) {
   *   console.log(`${position.userName} é ${position.position}`)
   * }
   */
  async findByUserIdWithUser(
    userId: string,
  ): Promise<TeamPositionWithUser | null> {
    if (!userId) {
      throw new BadRequestError({
        message:
          'O ID do usuário é obrigatório para buscar uma posição no repositório pg-team-positions-repository.',
        action: 'Forneça um ID de usuário válido e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT
          tp.id,
          tp.user_id,
          tp.position,
          tp.level,
          tp.assigned_by,
          tp.created_at,
          tp.updated_at,
          u.name AS user_name,
          u.email AS user_email,
          u.avatar AS user_avatar,
          ab.name AS assigned_by_name,
          ab.email AS assigned_by_email
        FROM team_positions tp
        JOIN users u ON u.id = tp.user_id
        JOIN users ab ON ab.id = tp.assigned_by
        WHERE tp.user_id = $1
        LIMIT 1
      `,
      values: [userId],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToTeamPositionWithUser(result.rows[0])
  }

  /**
   * Lista todas as posições de um determinado tipo com dados dos usuários
   *
   * @param position Tipo da posição ('director', 'supervisor', 'manager', 'assistant_manager', 'assistant')
   * @returns Lista de posições com dados dos usuários
   *
   * @example
   * // Listar todos os diretores
   * const directors = await repository.listByPosition('director')
   * directors.forEach(d => console.log(d.userName, d.userEmail))
   */
  async listByPosition(
    position: TeamPositionType,
  ): Promise<TeamPositionWithUser[]> {
    const result = await database.query({
      text: `
        SELECT
          tp.id,
          tp.user_id,
          tp.position,
          tp.level,
          tp.assigned_by,
          tp.created_at,
          tp.updated_at,
          u.name AS user_name,
          u.email AS user_email,
          u.avatar AS user_avatar,
          ab.name AS assigned_by_name,
          ab.email AS assigned_by_email
        FROM team_positions tp
        JOIN users u ON u.id = tp.user_id
        JOIN users ab ON ab.id = tp.assigned_by
        WHERE tp.position = $1
        ORDER BY u.name ASC
      `,
      values: [position],
    })

    return result.rows.map(
      (
        row: TeamPositionDb & {
          user_name: string | null
          user_email: string
          user_avatar: string | null
          assigned_by_name: string | null
          assigned_by_email: string
        },
      ) => this.mapToTeamPositionWithUser(row),
    )
  }

  /**
   * Mapeia uma linha do banco de dados para o formato TeamPosition
   */
  private mapToTeamPosition(row: TeamPositionDb): TeamPosition {
    return {
      id: row.id,
      userId: row.user_id,
      position: row.position,
      level: row.level,
      assignedBy: row.assigned_by,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  /**
   * Mapeia uma linha do banco de dados (com JOIN) para o formato TeamPositionWithUser
   */
  private mapToTeamPositionWithUser(
    row: TeamPositionDb & {
      user_name: string | null
      user_email: string
      user_avatar: string | null
      assigned_by_name: string | null
      assigned_by_email: string
    },
  ): TeamPositionWithUser {
    return {
      id: row.id,
      userId: row.user_id,
      position: row.position,
      level: row.level,
      assignedBy: row.assigned_by,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      userName: row.user_name,
      userEmail: row.user_email,
      userAvatar: row.user_avatar,
      assignedByName: row.assigned_by_name,
      assignedByEmail: row.assigned_by_email,
    }
  }

  /**
   * Lista todas as posições com seus vínculos hierárquicos para montar o organograma
   *
   * @returns Lista de membros com dados para montar a árvore hierárquica
   *
   * @example
   * // Buscar dados para o organograma
   * const members = await repository.listForOrganogram()
   * // Montar a árvore a partir dos dados
   */
  async listForOrganogram(): Promise<OrganogramMemberDb[]> {
    const result = await database.query({
      text: `
        SELECT
          tp.id,
          tp.user_id,
          tp.position,
          tp.level,
          u.name AS user_name,
          u.email AS user_email,
          u.account_status,
          u.booking_exception_until,
          tms.supervisor_id AS supervisor_position_id
        FROM team_positions tp
        JOIN users u ON u.id = tp.user_id
        LEFT JOIN team_member_supervisors tms ON tms.subordinate_id = tp.id
        ORDER BY tp.level ASC, u.name ASC
      `,
    })

    return result.rows.map(
      (row: {
        id: string
        user_id: string
        position: TeamPositionType
        level: number
        user_name: string | null
        user_email: string
        account_status: boolean
        booking_exception_until: Date | null
        supervisor_position_id: string | null
      }) => ({
        id: row.id,
        userId: row.user_id,
        position: row.position,
        level: row.level,
        userName: row.user_name,
        userEmail: row.user_email,
        accountStatus: row.account_status,
        bookingExceptionUntil: row.booking_exception_until
          ? row.booking_exception_until.toISOString()
          : null,
        supervisorPositionId: row.supervisor_position_id,
      }),
    )
  }
}
