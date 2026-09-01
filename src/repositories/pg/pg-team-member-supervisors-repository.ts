// src/repositories/pg/pg-team-member-supervisors-repository.ts

import { database } from '@/infra/database'
import { BadRequestError, DatabaseError } from '@/infra/errors'
import {
  ITeamMemberSupervisorsRepository,
  TeamMemberSupervisor,
  TeamMemberSupervisorCreate,
  TeamMemberSupervisorDb,
  TeamMemberSupervisorWithUsers,
} from '../base/team-member-supervisors-repository'
import { TeamPositionType } from '../base/team-positions-repository'

/**
 * Implementação PostgreSQL do repositório de relacionamentos hierárquicos
 *
 * Este repositório gerencia as operações de CRUD para a tabela team_member_supervisors,
 * permitindo criar e remover vínculos entre subordinados e superiores na hierarquia
 * da equipe de atendimento.
 */
export class PgTeamMemberSupervisorsRepository implements ITeamMemberSupervisorsRepository {
  /**
   * Cria um novo vínculo hierárquico entre subordinado e superior
   *
   * @param data Dados do vínculo (subordinateId, supervisorId)
   * @returns O vínculo criado
   * @throws BadRequestError se os IDs não forem fornecidos
   * @throws DatabaseError se falhar ao criar o vínculo
   *
   * @example
   * // Vincular supervisor a um gerente
   * const link = await repository.create({
   *   subordinateId: 'uuid-posicao-supervisor',
   *   supervisorId: 'uuid-posicao-gerente'
   * })
   */
  async create(
    data: TeamMemberSupervisorCreate,
  ): Promise<TeamMemberSupervisor> {
    if (!data.subordinateId) {
      throw new BadRequestError({
        message:
          'O ID da posição do subordinado é obrigatório para criar um vínculo no repositório pg-team-member-supervisors-repository.',
        action:
          'Forneça um ID de posição válido do subordinado e tente novamente.',
      })
    }

    if (!data.supervisorId) {
      throw new BadRequestError({
        message:
          'O ID da posição do superior é obrigatório para criar um vínculo no repositório pg-team-member-supervisors-repository.',
        action:
          'Forneça um ID de posição válido do superior e tente novamente.',
      })
    }

    const queryText = `
      INSERT INTO team_member_supervisors (subordinate_id, supervisor_id)
      VALUES ($1, $2)
      ON CONFLICT (subordinate_id, supervisor_id) DO NOTHING
      RETURNING *
    `

    const result = await database.query({
      text: queryText,
      values: [data.subordinateId, data.supervisorId],
    })

    // Se não retornou nada, o vínculo já existe - buscar o existente
    if (!result.rows[0]) {
      const existingResult = await database.query({
        text: `
          SELECT * FROM team_member_supervisors
          WHERE subordinate_id = $1 AND supervisor_id = $2
        `,
        values: [data.subordinateId, data.supervisorId],
      })

      if (existingResult.rows[0]) {
        return this.mapToTeamMemberSupervisor(existingResult.rows[0])
      }

      throw new DatabaseError({
        message:
          'Falha ao criar o vínculo hierárquico no repositório pg-team-member-supervisors-repository.',
        action: 'Verifique os parâmetros e tente novamente.',
      })
    }

    return this.mapToTeamMemberSupervisor(result.rows[0])
  }

  /**
   * Remove um vínculo hierárquico pelo ID
   *
   * @param id ID do vínculo
   * @throws BadRequestError se id não for fornecido
   */
  async deleteById(id: string): Promise<void> {
    if (!id) {
      throw new BadRequestError({
        message:
          'O ID do vínculo é obrigatório para remover no repositório pg-team-member-supervisors-repository.',
        action: 'Forneça um ID de vínculo válido e tente novamente.',
      })
    }

    await database.query({
      text: `
        DELETE FROM team_member_supervisors
        WHERE id = $1
      `,
      values: [id],
    })
  }

  /**
   * Remove todos os vínculos de um subordinado pelo ID da posição
   *
   * @param subordinateId ID da posição do subordinado em team_positions
   * @throws BadRequestError se subordinateId não for fornecido
   */
  async deleteBySubordinateId(subordinateId: string): Promise<void> {
    if (!subordinateId) {
      throw new BadRequestError({
        message:
          'O ID da posição do subordinado é obrigatório para remover vínculos no repositório pg-team-member-supervisors-repository.',
        action:
          'Forneça um ID de posição válido do subordinado e tente novamente.',
      })
    }

    await database.query({
      text: `
        DELETE FROM team_member_supervisors
        WHERE subordinate_id = $1
      `,
      values: [subordinateId],
    })
  }

  /**
   * Remove todos os vínculos de um superior pelo ID da posição
   *
   * @param supervisorId ID da posição do superior em team_positions
   * @throws BadRequestError se supervisorId não for fornecido
   */
  async deleteBySupervisorId(supervisorId: string): Promise<void> {
    if (!supervisorId) {
      throw new BadRequestError({
        message:
          'O ID da posição do superior é obrigatório para remover vínculos no repositório pg-team-member-supervisors-repository.',
        action:
          'Forneça um ID de posição válido do superior e tente novamente.',
      })
    }

    await database.query({
      text: `
        DELETE FROM team_member_supervisors
        WHERE supervisor_id = $1
      `,
      values: [supervisorId],
    })
  }

  /**
   * Busca um vínculo específico entre subordinado e superior
   *
   * @param subordinateId ID da posição do subordinado
   * @param supervisorId ID da posição do superior
   * @returns O vínculo encontrado ou null
   */
  async findBySubordinateAndSupervisor(
    subordinateId: string,
    supervisorId: string,
  ): Promise<TeamMemberSupervisor | null> {
    if (!subordinateId || !supervisorId) {
      throw new BadRequestError({
        message:
          'Os IDs de subordinado e superior são obrigatórios para buscar um vínculo no repositório pg-team-member-supervisors-repository.',
        action: 'Forneça os IDs válidos e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT *
        FROM team_member_supervisors
        WHERE subordinate_id = $1 AND supervisor_id = $2
        LIMIT 1
      `,
      values: [subordinateId, supervisorId],
    })

    if (!result.rows[0]) {
      return null
    }

    return this.mapToTeamMemberSupervisor(result.rows[0])
  }

  /**
   * Lista todos os subordinados de um superior (gerente ou supervisor)
   *
   * @param supervisorId ID da posição do superior em team_positions
   * @returns Lista de vínculos com dados dos usuários
   *
   * @example
   * // Listar todos os subordinados de um gerente
   * const subordinates = await repository.listSubordinates('uuid-posicao-gerente')
   */
  async listSubordinates(
    supervisorId: string,
  ): Promise<TeamMemberSupervisorWithUsers[]> {
    if (!supervisorId) {
      throw new BadRequestError({
        message:
          'O ID da posição do superior é obrigatório para listar subordinados no repositório pg-team-member-supervisors-repository.',
        action:
          'Forneça um ID de posição válido do superior e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT
          tms.id,
          tms.subordinate_id,
          tms.supervisor_id,
          tms.created_at,
          -- Dados do subordinado
          tp_sub.user_id AS subordinate_user_id,
          u_sub.name AS subordinate_user_name,
          u_sub.email AS subordinate_user_email,
          tp_sub.position AS subordinate_position,
          tp_sub.level AS subordinate_level,
          -- Dados do superior
          tp_sup.user_id AS supervisor_user_id,
          u_sup.name AS supervisor_user_name,
          u_sup.email AS supervisor_user_email,
          tp_sup.position AS supervisor_position,
          tp_sup.level AS supervisor_level
        FROM team_member_supervisors tms
        JOIN team_positions tp_sub ON tp_sub.id = tms.subordinate_id
        JOIN users u_sub ON u_sub.id = tp_sub.user_id
        JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id
        JOIN users u_sup ON u_sup.id = tp_sup.user_id
        WHERE tms.supervisor_id = $1
        ORDER BY u_sub.name ASC
      `,
      values: [supervisorId],
    })

    return result.rows.map((row: TeamMemberSupervisorDbWithUsers) =>
      this.mapToTeamMemberSupervisorWithUsers(row),
    )
  }

  /**
   * Lista todos os superiores de um subordinado (supervisor ou membro)
   *
   * @param subordinateId ID da posição do subordinado em team_positions
   * @returns Lista de vínculos com dados dos usuários
   */
  async listSupervisors(
    subordinateId: string,
  ): Promise<TeamMemberSupervisorWithUsers[]> {
    if (!subordinateId) {
      throw new BadRequestError({
        message:
          'O ID da posição do subordinado é obrigatório para listar superiores no repositório pg-team-member-supervisors-repository.',
        action:
          'Forneça um ID de posição válido do subordinado e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        SELECT
          tms.id,
          tms.subordinate_id,
          tms.supervisor_id,
          tms.created_at,
          -- Dados do subordinado
          tp_sub.user_id AS subordinate_user_id,
          u_sub.name AS subordinate_user_name,
          u_sub.email AS subordinate_user_email,
          tp_sub.position AS subordinate_position,
          tp_sub.level AS subordinate_level,
          -- Dados do superior
          tp_sup.user_id AS supervisor_user_id,
          u_sup.name AS supervisor_user_name,
          u_sup.email AS supervisor_user_email,
          tp_sup.position AS supervisor_position,
          tp_sup.level AS supervisor_level
        FROM team_member_supervisors tms
        JOIN team_positions tp_sub ON tp_sub.id = tms.subordinate_id
        JOIN users u_sub ON u_sub.id = tp_sub.user_id
        JOIN team_positions tp_sup ON tp_sup.id = tms.supervisor_id
        JOIN users u_sup ON u_sup.id = tp_sup.user_id
        WHERE tms.subordinate_id = $1
        ORDER BY u_sup.name ASC
      `,
      values: [subordinateId],
    })

    return result.rows.map((row: TeamMemberSupervisorDbWithUsers) =>
      this.mapToTeamMemberSupervisorWithUsers(row),
    )
  }

  /**
   * Mapeia uma linha do banco de dados para o formato TeamMemberSupervisor
   */
  private mapToTeamMemberSupervisor(
    row: TeamMemberSupervisorDb,
  ): TeamMemberSupervisor {
    return {
      id: row.id,
      subordinateId: row.subordinate_id,
      supervisorId: row.supervisor_id,
      createdAt: String(row.created_at),
    }
  }

  /**
   * Mapeia uma linha do banco de dados (com JOINs) para o formato TeamMemberSupervisorWithUsers
   */
  private mapToTeamMemberSupervisorWithUsers(
    row: TeamMemberSupervisorDbWithUsers,
  ): TeamMemberSupervisorWithUsers {
    return {
      id: row.id,
      subordinateId: row.subordinate_id,
      supervisorId: row.supervisor_id,
      createdAt: String(row.created_at),
      subordinateUserId: row.subordinate_user_id,
      subordinateUserName: row.subordinate_user_name,
      subordinateUserEmail: row.subordinate_user_email,
      subordinatePosition: row.subordinate_position,
      subordinateLevel: row.subordinate_level,
      supervisorUserId: row.supervisor_user_id,
      supervisorUserName: row.supervisor_user_name,
      supervisorUserEmail: row.supervisor_user_email,
      supervisorPosition: row.supervisor_position,
      supervisorLevel: row.supervisor_level,
    }
  }

  /**
   * Lista TODOS os subordinados de forma recursiva (toda a árvore hierárquica)
   * Usa CTE recursiva para percorrer toda a hierarquia abaixo do supervisor
   *
   * @param supervisorId ID da posição do superior em team_positions
   * @returns Lista de vínculos com dados dos usuários de toda a hierarquia abaixo
   *
   * @example
   * // Listar todos os subordinados recursivamente (gerentes, subgerentes, assistentes)
   * const allSubordinates = await repository.listAllSubordinatesRecursive('uuid-posicao-supervisor')
   */
  async listAllSubordinatesRecursive(
    supervisorId: string,
  ): Promise<TeamMemberSupervisorWithUsers[]> {
    if (!supervisorId) {
      throw new BadRequestError({
        message:
          'O ID da posição do superior é obrigatório para listar subordinados recursivamente.',
        action:
          'Forneça um ID de posição válido do superior e tente novamente.',
      })
    }

    const result = await database.query({
      text: `
        WITH RECURSIVE subordinate_tree AS (
          -- Caso base: subordinados diretos do supervisor
          SELECT
            tms.id,
            tms.subordinate_id,
            tms.supervisor_id,
            tms.created_at
          FROM team_member_supervisors tms
          WHERE tms.supervisor_id = $1

          UNION

          -- Caso recursivo: subordinados dos subordinados
          SELECT
            tms2.id,
            tms2.subordinate_id,
            tms2.supervisor_id,
            tms2.created_at
          FROM team_member_supervisors tms2
          INNER JOIN subordinate_tree st ON tms2.supervisor_id = st.subordinate_id
        )
        SELECT DISTINCT ON (tp_sub.user_id)
          st.id,
          st.subordinate_id,
          st.supervisor_id,
          st.created_at,
          -- Dados do subordinado
          tp_sub.user_id AS subordinate_user_id,
          u_sub.name AS subordinate_user_name,
          u_sub.email AS subordinate_user_email,
          tp_sub.position AS subordinate_position,
          tp_sub.level AS subordinate_level,
          -- Dados do superior imediato
          tp_sup.user_id AS supervisor_user_id,
          u_sup.name AS supervisor_user_name,
          u_sup.email AS supervisor_user_email,
          tp_sup.position AS supervisor_position,
          tp_sup.level AS supervisor_level
        FROM subordinate_tree st
        JOIN team_positions tp_sub ON tp_sub.id = st.subordinate_id
        JOIN users u_sub ON u_sub.id = tp_sub.user_id
        JOIN team_positions tp_sup ON tp_sup.id = st.supervisor_id
        JOIN users u_sup ON u_sup.id = tp_sup.user_id
        ORDER BY tp_sub.user_id, u_sub.name ASC
      `,
      values: [supervisorId],
    })

    return result.rows.map((row: TeamMemberSupervisorDbWithUsers) =>
      this.mapToTeamMemberSupervisorWithUsers(row),
    )
  }
}

/**
 * Interface auxiliar para tipagem das linhas com JOINs
 */
interface TeamMemberSupervisorDbWithUsers extends TeamMemberSupervisorDb {
  subordinate_user_id: string
  subordinate_user_name: string | null
  subordinate_user_email: string
  subordinate_position: TeamPositionType
  subordinate_level: number
  supervisor_user_id: string
  supervisor_user_name: string | null
  supervisor_user_email: string
  supervisor_position: TeamPositionType
  supervisor_level: number
}
