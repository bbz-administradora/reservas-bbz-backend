// src/repositories/base/team-member-supervisors-repository.ts

import { TeamPositionType } from './team-positions-repository'

/**
 * Interface que representa a estrutura da tabela team_member_supervisors no banco de dados
 *
 * Esta tabela armazena o relacionamento N:N entre subordinados e seus
 * superiores hierárquicos na equipe de atendimento.
 *
 * Vínculos permitidos:
 * - supervisor (level 2) → director (level 1)
 * - manager (level 3) → supervisor (level 2)
 * - assistant_manager (level 4) → manager (level 3)
 * - assistant (level 5) → manager (level 3) ou assistant_manager (level 4)
 */
export interface TeamMemberSupervisorDb {
  id: string
  subordinate_id: string
  supervisor_id: string
  created_at: Date
}

/**
 * Interface para criação de um novo vínculo hierárquico
 */
export interface TeamMemberSupervisorCreate {
  /** ID da posição do subordinado (supervisor ou membro) em team_positions */
  subordinateId: string
  /** ID da posição do superior (gerente ou supervisor) em team_positions */
  supervisorId: string
}

/**
 * Interface que representa um vínculo hierárquico no formato da aplicação (camelCase)
 */
export interface TeamMemberSupervisor {
  id: string
  subordinateId: string
  supervisorId: string
  createdAt: string
}

/**
 * Interface que representa um vínculo hierárquico com dados dos usuários envolvidos
 * Utilizada para listagens e exibição no frontend
 */
export interface TeamMemberSupervisorWithUsers {
  id: string
  subordinateId: string
  supervisorId: string
  createdAt: string
  // Dados do subordinado
  subordinateUserId: string
  subordinateUserName: string | null
  subordinateUserEmail: string
  subordinatePosition: TeamPositionType
  subordinateLevel: number
  // Dados do superior
  supervisorUserId: string
  supervisorUserName: string | null
  supervisorUserEmail: string
  supervisorPosition: TeamPositionType
  supervisorLevel: number
}

/**
 * Interface do repositório de relacionamentos hierárquicos da equipe
 *
 * Define os métodos necessários para gerenciar os vínculos entre
 * subordinados e superiores na hierarquia da equipe de atendimento.
 */
export interface ITeamMemberSupervisorsRepository {
  /**
   * Cria um novo vínculo hierárquico entre subordinado e superior
   * @param data Dados do vínculo a ser criado
   * @returns O vínculo criado
   */
  create(data: TeamMemberSupervisorCreate): Promise<TeamMemberSupervisor>

  /**
   * Remove um vínculo hierárquico pelo ID
   * @param id ID do vínculo
   */
  deleteById(id: string): Promise<void>

  /**
   * Remove todos os vínculos de um subordinado pelo ID da posição
   * @param subordinateId ID da posição do subordinado em team_positions
   */
  deleteBySubordinateId(subordinateId: string): Promise<void>

  /**
   * Remove todos os vínculos de um superior pelo ID da posição
   * @param supervisorId ID da posição do superior em team_positions
   */
  deleteBySupervisorId(supervisorId: string): Promise<void>

  /**
   * Busca um vínculo específico entre subordinado e superior
   * @param subordinateId ID da posição do subordinado
   * @param supervisorId ID da posição do superior
   * @returns O vínculo encontrado ou null
   */
  findBySubordinateAndSupervisor(
    subordinateId: string,
    supervisorId: string,
  ): Promise<TeamMemberSupervisor | null>

  /**
   * Lista todos os subordinados de um superior (gerente ou supervisor)
   * @param supervisorId ID da posição do superior em team_positions
   * @returns Lista de vínculos com dados dos usuários
   */
  listSubordinates(
    supervisorId: string,
  ): Promise<TeamMemberSupervisorWithUsers[]>

  /**
   * Lista todos os superiores de um subordinado (supervisor ou membro)
   * @param subordinateId ID da posição do subordinado em team_positions
   * @returns Lista de vínculos com dados dos usuários
   */
  listSupervisors(
    subordinateId: string,
  ): Promise<TeamMemberSupervisorWithUsers[]>

  /**
   * Lista TODOS os subordinados de forma recursiva (toda a árvore hierárquica)
   * @param supervisorId ID da posição do superior em team_positions
   * @returns Lista de vínculos com dados dos usuários de toda a hierarquia abaixo
   */
  listAllSubordinatesRecursive(
    supervisorId: string,
  ): Promise<TeamMemberSupervisorWithUsers[]>
}
