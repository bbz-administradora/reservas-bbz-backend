// src/models/space/space-delete-use-case.ts
import {
  NotFoundErrorSchema,
  UnauthorizedErrorSchema,
} from '@/@types/http-errors-schema'
import { NotFoundError } from '@/infra/errors'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { FastifyRequest } from 'fastify'

export interface DeleteSpaceInput {
  request: FastifyRequest
  params: {
    id: string
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
}

export async function deleteSpace(
  { request, params }: DeleteSpaceInput,
  deps: Dependencies,
) {
  // 📌 Verifica se o espaço existe
  const spaceExists = await deps.spacesRepository.findById(params.id)

  if (!spaceExists) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço e tente novamente',
      details: {
        where: 'space.delete',
        spaceId: params.id,
      },
    })
  }

  // 📌 Exclui o espaço permanentemente (hard delete)
  await deps.spacesRepository.deleteById(params.id)

  return {
    message: 'Espaço excluído com sucesso',
  }
}

export const deleteSpaceSchema = {
  401: UnauthorizedErrorSchema,
  404: NotFoundErrorSchema,
}
