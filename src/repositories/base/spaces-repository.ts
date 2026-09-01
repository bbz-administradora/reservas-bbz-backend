// src/repositories/base/spaces-repository.ts

export interface SpaceDb {
  id: string
  user_id: string
  name: string
  description: string | null
  recursos: string[]
  imagens: string[]
  capacidade: number
  type: 'room' | 'workstation'
  floor: string | null
  zone: string | null
  position: string | null
  qrcode_url: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  user_name: string
}

export interface SpaceCreate {
  id?: string
  userId: string
  name: string
  description?: string | null
  recursos?: string[]
  imagens?: string[]
  capacidade: number
  type?: 'room' | 'workstation'
  floor?: string | null
  zone?: string | null
  position?: string | null
  qrcodeUrl?: string | null
  isActive?: boolean
}

export interface SpaceUpdate {
  id: string
  name?: string
  description?: string | null
  recursos?: string[]
  imagens?: string[]
  capacidade?: number
  type?: 'room' | 'workstation'
  floor?: string | null
  zone?: string | null
  position?: string | null
  qrcodeUrl?: string | null
  isActive?: boolean
}

export interface Space {
  id: string
  userId: string
  name: string
  description: string | null
  recursos: string[]
  imagens: string[]
  capacidade: number
  type: 'room' | 'workstation'
  floor: string | null
  zone: string | null
  position: string | null
  qrcodeUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  userName: string
}

export interface SpaceFilters {
  searchTerm?: string
  isActive?: boolean
  capacidade?: number
  type?: 'room' | 'workstation'
  floor?: string
  zone?: string
}

export interface PaginatedSpaces {
  spaces: Space[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface ISpaceRepository {
  create(space: SpaceCreate): Promise<Space>
  update(space: SpaceUpdate): Promise<Space>
  deleteById(id: string): Promise<void>
  findById(id: string): Promise<Space | null>
  findByName(name: string): Promise<Space | null>
  updateQrcodeUrl(spaceId: string, qrcodeUrl: string): Promise<Space>
  listSpaces(
    filters?: SpaceFilters,
    page?: number,
    pageSize?: number,
  ): Promise<PaginatedSpaces>
}
