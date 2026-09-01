// src/models/space/space-list-use-case.ts
import { BadRequestError } from '@/infra/errors'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'

export interface ListSpacesInput {
  query: {
    page?: number
    pageSize?: number
    searchTerm?: string
    isActive?: boolean
    capacidade?: number
    type?: 'room' | 'workstation'
    floor?: string
    zone?: string
    position?: string
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
}

export async function listSpaces(
  { query }: ListSpacesInput,
  deps: Dependencies,
) {
  // Validar os parâmetros de paginação
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 1000

  if (page < 1) {
    throw new BadRequestError({
      message: 'O número da página deve ser maior ou igual a 1',
      action: 'Corrija o parâmetro page na URL',
      details: {
        where: 'space.list',
        providedPage: page,
        reason: 'invalid_page_number',
      },
    })
  }

  if (pageSize < 1 || pageSize > 1000) {
    throw new BadRequestError({
      message: 'O tamanho da página deve estar entre 1 e 1000',
      action: 'Corrija o parâmetro pageSize na URL',
      details: {
        where: 'space.list',
        providedPageSize: pageSize,
        reason: 'invalid_page_size',
      },
    })
  }

  // 📌 Filtra os espaços
  const filters = {
    searchTerm: query.searchTerm,
    isActive: query.isActive,
    capacidade: query.capacidade,
    type: query.type,
    floor: query.floor,
    zone: query.zone,
    position: query.position,
  }

  // 📌 Busca os espaços com paginação
  const result = await deps.spacesRepository.listSpaces(filters, page, pageSize)

  return {
    spaces: result.spaces,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
  }
}

export const listSpacesSchema = {}
