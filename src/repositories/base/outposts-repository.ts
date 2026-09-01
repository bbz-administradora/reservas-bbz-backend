// src/repositories/base/outposts-repository.ts

/**
 * Interface do banco de dados (snake_case)
 */
export interface OutpostDb {
  id: string
  user_id: string
  client_name: string
  client_address: string
  start_date: Date
  end_date: Date | null
  weekdays: number[]
  created_by: string
  created_at: Date
  updated_at: Date
}

/**
 * Interface da aplicação (camelCase)
 */
export interface Outpost {
  id: string
  userId: string
  clientName: string
  clientAddress: string
  startDate: string
  endDate: string | null
  weekdays: number[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

/**
 * Outpost com dados do usuário para listagem
 */
export interface OutpostWithUser extends Outpost {
  userName: string | null
  userEmail: string
  userPosition: string | null
}

/**
 * Interface para criação de outpost
 */
export interface OutpostCreate {
  userId: string
  clientName: string
  clientAddress: string
  startDate: string
  endDate?: string | null
  weekdays: number[]
  createdBy: string
}

/**
 * Interface para atualização de outpost
 */
export interface OutpostUpdate {
  id: string
  clientName?: string
  clientAddress?: string
  endDate?: string | null
  weekdays?: number[]
}

/**
 * Filtros para listagem de outposts
 */
export interface OutpostFilters {
  /** Filtrar por status: 'active' | 'ended' | 'all' */
  status?: 'active' | 'ended' | 'all'
  /** Busca por nome ou email do usuário */
  search?: string
  /** Filtrar por usuário específico */
  userId?: string
  /** IDs de usuários para filtrar (usado por supervisores) */
  userIds?: string[]
}

/**
 * Resposta paginada de outposts
 */
export interface PaginatedOutposts {
  outposts: OutpostWithUser[]
  totalCount: number
  totalPages: number
  currentPage: number
}

/**
 * Interface do repositório de Outposts
 */
export interface IOutpostsRepository {
  /**
   * Cria um novo posto avançado
   */
  create(outpost: OutpostCreate): Promise<Outpost>

  /**
   * Busca um posto avançado por ID
   */
  findById(id: string): Promise<Outpost | null>

  /**
   * Busca um posto avançado por ID com dados do usuário
   */
  findByIdWithUser(id: string): Promise<OutpostWithUser | null>

  /**
   * Lista postos avançados com filtros e paginação
   */
  list(
    page: number,
    limit: number,
    filters?: OutpostFilters,
  ): Promise<PaginatedOutposts>

  /**
   * Atualiza um posto avançado
   */
  update(outpost: OutpostUpdate): Promise<Outpost>

  /**
   * Encerra um posto avançado (seta end_date para ontem)
   */
  endOutpost(id: string): Promise<Outpost>

  /**
   * Verifica se o usuário está em posto avançado hoje
   * Retorna true se tem pelo menos 1 posto ativo na data atual
   */
  isUserOnOutpost(userId: string): Promise<boolean>

  /**
   * Lista todos os postos ativos de um usuário
   */
  listActiveByUserId(userId: string): Promise<Outpost[]>
}
