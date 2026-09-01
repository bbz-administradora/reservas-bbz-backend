// src/models/outpost/outpost-list-use-case.ts

import { ForbiddenErrorSchema } from '@/@types/http-errors-schema'
import { ForbiddenError } from '@/infra/errors'
import { IOutpostsRepository } from '@/repositories/base/outposts-repository'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import {
  OutpostListQuery,
  OutpostListResponse,
} from '@/schemas/outpost/outpost-schema'
import { FastifyRequest } from 'fastify'

export interface OutpostListInput {
  request: FastifyRequest
  query: OutpostListQuery
}

interface Dependencies {
  outpostsRepository: IOutpostsRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Use Case: Listar postos avançados
 *
 * Regras de negócio:
 * 1. Admin/Dev: vê todos os postos
 * 2. Diretor: vê todos os postos
 * 3. Supervisor: vê apenas postos da própria equipe
 * 4. Outros: não podem listar
 */
export async function outpostListUseCase(
  { request, query }: OutpostListInput,
  deps: Dependencies,
): Promise<OutpostListResponse> {
  const requestUserId = request.requestContext.get('userId') as string
  const requestUserRole = request.requestContext.get('userRole') as string

  const { page, limit, status, search } = query

  // 📌 Verificar permissões
  const isAdminOrDev = ['admin', 'dev'].includes(requestUserRole)

  // Buscar posição do usuário que está fazendo a requisição
  const requestUserPosition =
    await deps.teamPositionsRepository.findByUserId(requestUserId)
  const isDirector = requestUserPosition?.position === 'director'
  const isSupervisor = requestUserPosition?.position === 'supervisor'

  // Verificar se tem permissão
  if (!isAdminOrDev && !isDirector && !isSupervisor) {
    throw new ForbiddenError({
      message: 'Você não tem permissão para visualizar postos avançados.',
      action:
        'Apenas supervisores, diretores e administradores podem visualizar postos avançados.',
    })
  }

  // 📌 Definir filtro de usuários (supervisor vê apenas sua equipe)
  let userIds: string[] | undefined

  if (isSupervisor && !isAdminOrDev && !isDirector) {
    // Buscar subordinados do supervisor
    const subordinates =
      await deps.teamMemberSupervisorsRepository.listAllSubordinatesRecursive(
        requestUserPosition!.id,
      )

    userIds = subordinates.map((sub) => sub.subordinateUserId)

    // Se não tem subordinados, retornar lista vazia
    if (userIds.length === 0) {
      return {
        outposts: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      }
    }
  }

  // 📌 Listar postos
  const result = await deps.outpostsRepository.list(page, limit, {
    status,
    search,
    userIds,
  })

  return result
}

export const outpostListUseCaseSchema = {
  403: ForbiddenErrorSchema,
}
