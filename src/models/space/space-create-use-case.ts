// src/models/space/space-create-use-case.ts
import {
  ConflictErrorSchema,
  UnauthorizedErrorSchema,
} from '@/@types/http-errors-schema'
import { ConflictError, UnauthorizedError } from '@/infra/errors'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { FastifyRequest } from 'fastify'

export interface CreateSpaceInput {
  request: FastifyRequest
  data: {
    name: string
    description?: string | null
    recursos?: string[]
    imagens?: string[]
    capacidade: number
    isActive?: boolean
    type: 'room' | 'workstation'
    floor?: string | null
    zone?: string | null
    position?: string | null
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
}

export async function createSpace(
  { request, data }: CreateSpaceInput,
  deps: Dependencies,
) {
  // 📌 Get userAccount of context
  const userAccount = request.requestContext.get('userAccount')
  if (!userAccount) {
    throw new UnauthorizedError({
      message: 'Usuário não autorizado',
      action: 'Faça login para continuar',
      details: {
        where: 'space.create',
        reason: 'missing_user_account_context',
      },
    })
  }

  // 📌 Verifica se o espaço já existe
  const spaceExists = await deps.spacesRepository.findByName(data.name)

  if (spaceExists) {
    throw new ConflictError({
      message: 'Espaço já existe',
      action: 'Escolha outro nome para o espaço',
      details: {
        where: 'space.create',
        existingSpaceId: spaceExists.id,
        spaceName: data.name,
      },
    })
  }

  // 📌 Cria espaço
  const space = await deps.spacesRepository.create({
    userId: userAccount.id,
    name: data.name,
    description: data.description,
    recursos: data.recursos,
    imagens: data.imagens,
    capacidade: data.capacidade,
    isActive: data.isActive ?? true,
    type: data.type,
    floor: data.floor,
    zone: data.zone,
    position: data.position,
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
      userName: userAccount.name as string,
    },
    message: 'Espaço criado com sucesso',
  }
}

export const createSpaceSchema = {
  401: UnauthorizedErrorSchema,
  409: ConflictErrorSchema,
}
