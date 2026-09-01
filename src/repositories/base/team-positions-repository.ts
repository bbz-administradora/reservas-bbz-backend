// src/repositories/base/team-positions-repository.ts

/**
 * Tipos de posição na hierarquia da equipe de atendimento
 *
 * Níveis hierárquicos:
 * - director (level 1): Único, nomeia supervisores
 * - supervisor (level 2): ~7, nomeia gerentes
 * - manager (level 3): ~56, nomeia subgerentes e assistentes
 * - assistant_manager (level 4): ~20, subgerente do núcleo
 * - assistant (level 5): ~54, base da equipe
 */
export type TeamPositionType =
  'director' | 'supervisor' | 'manager' | 'assistant_manager' | 'assistant'

/**
 * Mapeamento de posição para nível hierárquico
 */
export const POSITION_LEVELS: Record<TeamPositionType, number> = {
  director: 1,
  supervisor: 2,
  manager: 3,
  assistant_manager: 4,
  assistant: 5,
}

/**
 * Interface que representa a estrutura da tabela team_positions no banco de dados
 */
export interface TeamPositionDb {
  id: string
  user_id: string
  position: TeamPositionType
  level: number
  assigned_by: string
  created_at: Date
  updated_at: Date
}

/**
 * Interface para criação de uma nova posição
 */
export interface TeamPositionCreate {
  userId: string
  position: TeamPositionType
  assignedBy: string
  /** ID da posição do chefe imediato (team_positions.id) - opcional */
  supervisorPositionId?: string | null
}

/**
 * Interface que representa uma posição no formato da aplicação (camelCase)
 */
export interface TeamPosition {
  id: string
  userId: string
  position: TeamPositionType
  level: number
  assignedBy: string
  createdAt: string
  updatedAt: string
}

/**
 * Interface que representa uma posição com dados do usuário
 * Utilizada para listagens e exibição no frontend
 */
export interface TeamPositionWithUser {
  id: string
  userId: string
  position: TeamPositionType
  level: number
  assignedBy: string
  createdAt: string
  updatedAt: string
  // Dados do usuário que possui a posição
  userName: string | null
  userEmail: string
  userAvatar: string | null
  // Dados de quem nomeou
  assignedByName: string | null
  assignedByEmail: string
}

/**
 * Interface que representa um membro do organograma
 * Utilizada para montar a árvore hierárquica
 */
export interface OrganogramMemberDb {
  id: string
  userId: string
  position: TeamPositionType
  level: number
  userName: string | null
  userEmail: string
  supervisorPositionId: string | null
  /** Se a conta do usuário está ativa */
  accountStatus: boolean
  /** Data/hora limite da exceção de reserva (para liberar regras) */
  bookingExceptionUntil: string | null
}

/**
 * Interface do repositório de posições da equipe
 *
 * Define os métodos necessários para gerenciar as posições
 * na hierarquia da equipe de atendimento.
 */
export interface ITeamPositionsRepository {
  /**
   * Cria uma nova posição para um usuário
   * @param data Dados da posição a ser criada
   * @returns A posição criada
   */
  create(data: TeamPositionCreate): Promise<TeamPosition>

  /**
   * Remove a posição de um usuário pelo user_id
   * @param userId ID do usuário
   */
  deleteByUserId(userId: string): Promise<void>

  /**
   * Busca a posição de um usuário pelo user_id
   * @param userId ID do usuário
   * @returns A posição encontrada ou null
   */
  findByUserId(userId: string): Promise<TeamPosition | null>

  /**
   * Busca a posição de um usuário pelo user_id com dados do usuário e de quem nomeou
   * @param userId ID do usuário
   * @returns A posição com dados do usuário ou null
   */
  findByUserIdWithUser(userId: string): Promise<TeamPositionWithUser | null>

  /**
   * Lista todas as posições de um determinado tipo (manager, supervisor, member)
   * com dados dos usuários
   * @param position Tipo da posição a ser listada
   * @returns Lista de posições com dados dos usuários
   */
  listByPosition(position: TeamPositionType): Promise<TeamPositionWithUser[]>

  /**
   * Lista todas as posições com seus vínculos hierárquicos para montar o organograma
   * @returns Lista de membros com dados para montar a árvore hierárquica
   */
  listForOrganogram(): Promise<OrganogramMemberDb[]>
}
