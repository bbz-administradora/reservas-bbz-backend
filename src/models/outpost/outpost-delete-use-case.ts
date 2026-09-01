// src/models/outpost/outpost-delete-use-case.ts

import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { IOutpostsRepository } from '@/repositories/base/outposts-repository'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import {
  OutpostDeleteParams,
  OutpostDeleteResponse,
} from '@/schemas/outpost/outpost-schema'
import { FastifyRequest } from 'fastify'

export interface OutpostDeleteInput {
  request: FastifyRequest
  params: OutpostDeleteParams
}

interface Dependencies {
  outpostsRepository: IOutpostsRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Use Case: Encerrar posto avançado
 *
 * Regras de negócio:
 * 1. Admin/Dev: podem encerrar qualquer posto
 * 2. Diretor: pode encerrar qualquer posto
 * 3. Supervisor: pode encerrar apenas postos de membros da própria equipe
 * 4. Outros: não podem encerrar
 * 5. Encerrar = setar end_date para data anterior (mantém histórico)
 * 6. Não pode encerrar um posto já encerrado
 */
export async function outpostDeleteUseCase(
  { request, params }: OutpostDeleteInput,
  deps: Dependencies,
): Promise<OutpostDeleteResponse> {
  const requestUserId = request.requestContext.get('userId') as string
  const requestUserRole = request.requestContext.get('userRole') as string

  const { id } = params

  // 📌 Verifica se o posto existe
  const existingOutpost = await deps.outpostsRepository.findById(id)
  if (!existingOutpost) {
    throw new NotFoundError({
      message: 'Posto avançado não encontrado.',
      action: 'Verifique se o ID do posto está correto.',
    })
  }

  // 📌 Verifica se o posto já está encerrado
  if (existingOutpost.endDate) {
    const endDate = new Date(existingOutpost.endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (endDate < today) {
      throw new BadRequestError({
        message: 'Este posto avançado já foi encerrado.',
        action: 'Não é possível encerrar um posto que já está encerrado.',
      })
    }
  }

  // 📌 Verificar permissões
  const isAdminOrDev = ['admin', 'dev'].includes(requestUserRole)

  const requestUserPosition =
    await deps.teamPositionsRepository.findByUserId(requestUserId)
  const isDirector = requestUserPosition?.position === 'director'
  const isSupervisor = requestUserPosition?.position === 'supervisor'

  // Admin, Dev e Diretor podem encerrar qualquer posto
  if (!isAdminOrDev && !isDirector) {
    if (!isSupervisor) {
      throw new ForbiddenError({
        message: 'Você não tem permissão para encerrar postos avançados.',
        action:
          'Apenas supervisores, diretores e administradores podem encerrar postos avançados.',
      })
    }

    // Verificar se o usuário do posto é subordinado do supervisor
    if (requestUserPosition) {
      const subordinates =
        await deps.teamMemberSupervisorsRepository.listAllSubordinatesRecursive(
          requestUserPosition.id,
        )

      const isSubordinate = subordinates.some(
        (sub) => sub.subordinateUserId === existingOutpost.userId,
      )

      if (!isSubordinate) {
        throw new ForbiddenError({
          message:
            'Você só pode encerrar postos avançados de membros da sua equipe.',
          action:
            'Verifique se o usuário pertence à sua equipe ou solicite a um administrador.',
        })
      }
    }
  }

  // 📌 Encerrar posto (seta end_date para ontem)
  const endedOutpost = await deps.outpostsRepository.endOutpost(id)

  return {
    message: 'Posto avançado encerrado com sucesso.',
    outpost: endedOutpost,
  }
}

export const outpostDeleteUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
