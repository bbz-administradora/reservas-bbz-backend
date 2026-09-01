// src/repositories/base/space-slot-repository.ts
export interface SpaceSlotDb {
  id: string
  space_id: string
  slot_range: [Date, Date] // [start, end] in UTC
  status: 'pre_reserved' | 'reserved'
  user_id: string // who pre-reserved or reserved
  pre_reserved_until: Date // expiration timestamp, non-null
  created_at: Date
  updated_at: Date
}

export interface SpaceSlotCreate {
  spaceId: string
  userId: string
  slotStart: string // ISO string in user tz, to be converted to UTC
  slotEnd: string // ISO string in user tz, to be converted to UTC
  status: 'reserved' | 'pre_reserved'
  preReservedUntil: string // ISO string in user tz, to be converted to UTC
}

export interface SpaceSlotUpdate {
  slotId: string
  status?: 'reserved' | 'pre_reserved'
  userId?: string
  preReservedUntil?: string
  slotStart?: string // ISO string in user tz, to be converted to UTC
  slotEnd?: string // ISO string in user tz, to be converted to UTC
  spaceId?: string
}

export interface SpaceSlot {
  id: string
  spaceId: string
  slotStart: string // ISO in user tz
  slotEnd: string // ISO in user tz
  status: 'pre_reserved' | 'reserved'
  userId: string // who holds the reservation
  preReservedUntil: string // expiration timestamp
  createdAt: string
  updatedAt: string
}

export interface AvailableSpace {
  id: string
  name: string
  description: string | null
  recursos: string[]
  imagens: string[]
  capacidade: number
  type: 'room' | 'workstation'
  floor: string | null
  zone: string | null
  position: string | null
}

export interface PaginatedAvailableSpaces {
  spaces: AvailableSpace[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface PreReservedUser {
  id: string
  name: string
  email: string
}

export interface SpaceSlotWithUser {
  id: string
  slotStart: string // ISO in user tz
  slotEnd: string
  status: 'reserved' | 'pre_reserved'
  user: PreReservedUser // always present
  preReservedUntil: string // expiration timestamp
}

export interface SpaceWithSlots {
  space: {
    id: string
    name: string
    description: string | null
    recursos: string[]
    imagens: string[]
    capacidade: number
    isActive: boolean
    type: 'room' | 'workstation'
    floor: string | null
    zone: string | null
    position: string | null
  }
  slots: SpaceSlotWithUser[] // each hour as occupied or free
}

export interface ISpaceSlotRepository {
  createPreReservation(input: SpaceSlotCreate): Promise<SpaceSlot>
  deleteById(slotId: string): Promise<void>
  /**
   * Deleta múltiplos slots de uma vez por seus IDs.
   * Otimização para evitar N queries em loops.
   * @param slotIds Array de IDs dos slots a serem deletados
   */
  deleteByIds(slotIds: string[]): Promise<void>
  deleteAllBySpaceId(spaceId: string): Promise<void>
  confirmReservation(slotId: string, userId: string): Promise<SpaceSlot>
  updateSpaceSlot(input: SpaceSlotUpdate): Promise<SpaceSlot>
  findById(slotId: string): Promise<SpaceSlot | null>
  /**
   * Busca múltiplos slots de uma vez por seus IDs.
   * Otimização para evitar N queries em loops.
   * @param slotIds Array de IDs dos slots a serem buscados
   * @returns Array de slots encontrados (pode ter menos itens que slotIds se alguns não existirem)
   */
  findByIds(slotIds: string[]): Promise<SpaceSlot[]>
  findBySpaceAndStart(
    spaceId: string,
    slotStart: string,
  ): Promise<SpaceSlot | null>
  listAvailableSpacesByDate(
    date: string, // YYYY-MM-DD, default today
    page?: number,
    pageSize?: number,
    startHour?: string, // HH:mm, default 07:00
    endHour?: string, // HH:mm, default 20:00
    timeZoneOffset?: string, // default -03:00
    type?: 'room' | 'workstation', // default 'room'
  ): Promise<PaginatedAvailableSpaces>
  listAvailableSpacesByDateAndHour(
    date: string, // YYYY-MM-DD, default today
    hour: string, // HH:mm
    page?: number,
    pageSize?: number,
    durationMinutes?: number, // default 60
    timeZoneOffset?: string, // default -03:00
    type?: 'room' | 'workstation', // default 'room'
  ): Promise<PaginatedAvailableSpaces>
  getSpaceAvailability(
    spaceId: string,
    startDate: string, // YYYY-MM-DD
    endDate: string, // YYYY-MM-DD
    startHour: string, // HH:mm
    endHour: string, // HH:mm
    timeZoneOffset: string,
  ): Promise<SpaceWithSlots>
}
