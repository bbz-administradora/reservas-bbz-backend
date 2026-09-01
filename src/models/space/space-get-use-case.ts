// src/models/space/space-get-use-case.ts
import { NotFoundErrorSchema } from '@/@types/http-errors-schema'
import { NotFoundError } from '@/infra/errors'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'

export interface GetSpaceInput {
  params: {
    id: string
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
}

export async function getSpace({ params }: GetSpaceInput, deps: Dependencies) {
  // 📌 Busca o espaço pelo ID
  const space = await deps.spacesRepository.findById(params.id)

  if (!space) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço e tente novamente',
      details: {
        where: 'space.get',
        spaceId: params.id,
      },
    })
  }

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
      userName: space.userName,
    },
  }
}

export const getSpaceSchema = {
  404: NotFoundErrorSchema,
}
