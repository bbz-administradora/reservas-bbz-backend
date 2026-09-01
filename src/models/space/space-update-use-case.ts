// src/models/space/space-update-use-case.ts
import {
  ConflictErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { ConflictError, NotFoundError } from '@/infra/errors'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'

export interface UpdateSpaceInput {
  params: {
    id: string
  }
  data: {
    name?: string
    description?: string | null
    recursos?: string[]
    imagens?: string[]
    capacidade?: number
    isActive?: boolean
    type?: 'room' | 'workstation'
    floor?: string | null
    zone?: string | null
    position?: string | null
    qrcodeUrl?: string | null
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
}

export async function updateSpace(
  { params, data }: UpdateSpaceInput,
  deps: Dependencies,
) {
  console.log('🚀 ~ updateSpace ~ data:', data)
  console.log('🚀 ~ updateSpace ~ params:', params)
  // 📌 Verifica se o espaço existe
  const spaceExists = await deps.spacesRepository.findById(params.id)

  if (!spaceExists) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço e tente novamente',
      details: {
        where: 'space.update',
        spaceId: params.id,
      },
    })
  }

  // 📌 Verifica se o nome do espaço já existe
  if (data.name) {
    const spaceNameExists = await deps.spacesRepository.findByName(data.name)
    if (spaceNameExists && spaceNameExists.id !== params.id) {
      throw new ConflictError({
        message: 'Nome do espaço já existe',
        action: 'Escolha um nome diferente para o espaço',
        details: {
          where: 'space.update',
          spaceId: params.id,
          existingSpaceId: spaceNameExists.id,
          spaceName: data.name,
        },
      })
    }
  }

  // 📌 Atualiza o espaço
  const space = await deps.spacesRepository.update({
    id: params.id,
    ...data,
  })

  return {
    space: {
      id: space.id,
      userId: space.userId,
      name: space.name,
      description: space.description,
      recursos: space.recursos,
      imagens: space.imagens,
      capacidade: space.capacidade,
      isActive: space.isActive,
      type: space.type,
      floor: space.floor,
      zone: space.zone,
      position: space.position,
      qrcodeUrl: space.qrcodeUrl,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
    },
    message: 'Espaço atualizado com sucesso',
  }
}

export const updateSpaceSchema = {
  404: NotFoundErrorSchema,
  409: ConflictErrorSchema,
}
