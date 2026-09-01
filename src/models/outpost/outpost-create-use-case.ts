// src/models/outpost/outpost-create-use-case.ts

import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { IOutpostsRepository } from '@/repositories/base/outposts-repository'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { IUserRepository } from '@/repositories/base/users-repository'
import {
  OutpostCreateBody,
  OutpostCreateResponse,
} from '@/schemas/outpost/outpost-schema'
import { FastifyRequest } from 'fastify'

export interface OutpostCreateInput {
  request: FastifyRequest
  body: OutpostCreateBody
}

interface Dependencies {
  outpostsRepository: IOutpostsRepository
  usersRepository: IUserRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Use Case: Criar posto avançado
 *
 * Regras de negócio:
 * 1. Admin/Dev: podem criar para qualquer usuário
 * 2. Diretor: pode criar para qualquer usuário
 * 3. Supervisor: pode criar apenas para membros da própria equipe
 * 4. Outros: não podem criar
 * 5. Validar se o usuário alvo existe
 * 6. Validar datas (start_date <= end_date se end_date informada)
 * 7. Validar weekdays (pelo menos 1)
 */
export async function outpostCreateUseCase(
  { request, body }: OutpostCreateInput,
  deps: Dependencies,
): Promise<OutpostCreateResponse> {
  const requestUserId = request.requestContext.get('userId') as string
  const requestUserRole = request.requestContext.get('userRole') as string

  const { userId, clientName, clientAddress, startDate, endDate, weekdays } =
    body

  // 📌 Verifica se o usuário alvo existe
  const targetUser = await deps.usersRepository.findById(userId)
  if (!targetUser) {
    throw new NotFoundError({
      message: 'Usuário não encontrado.',
      action: 'Verifique se o ID do usuário está correto.',
    })
  }

  // 📌 Validação de datas
  if (endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      throw new BadRequestError({
        message: 'A data de início não pode ser posterior à data fim.',
        action: 'Corrija as datas e tente novamente.',
      })
    }
  }

  // 📌 Validação de weekdays
  if (!weekdays || weekdays.length === 0) {
    throw new BadRequestError({
      message: 'Selecione pelo menos um dia da semana.',
      action: 'Escolha os dias em que o colaborador estará no posto avançado.',
    })
  }

  // 📌 Verificar permissões
  const isAdminOrDev = ['admin', 'dev'].includes(requestUserRole)

  // Buscar posição do usuário que está fazendo a requisição
  const requestUserPosition =
    await deps.teamPositionsRepository.findByUserId(requestUserId)
  const isDirector = requestUserPosition?.position === 'director'
  const isSupervisor = requestUserPosition?.position === 'supervisor'

  // Admin, Dev e Diretor podem criar para qualquer usuário
  if (!isAdminOrDev && !isDirector) {
    // Supervisor só pode criar para sua equipe
    if (!isSupervisor) {
      throw new ForbiddenError({
        message: 'Você não tem permissão para cadastrar postos avançados.',
        action:
          'Apenas supervisores, diretores e administradores podem cadastrar postos avançados.',
      })
    }

    // Verificar se o usuário alvo é subordinado do supervisor
    if (requestUserPosition) {
      const subordinates =
        await deps.teamMemberSupervisorsRepository.listAllSubordinatesRecursive(
          requestUserPosition.id,
        )

      const isSubordinate = subordinates.some(
        (sub) => sub.subordinateUserId === userId,
      )

      if (!isSubordinate) {
        throw new ForbiddenError({
          message:
            'Você só pode cadastrar postos avançados para membros da sua equipe.',
          action:
            'Verifique se o usuário pertence à sua equipe ou solicite a um administrador.',
        })
      }
    }
  }

  // 📌 Criar posto avançado
  const outpost = await deps.outpostsRepository.create({
    userId,
    clientName,
    clientAddress,
    startDate,
    endDate: endDate ?? null,
    weekdays,
    createdBy: requestUserId,
  })

  return {
    message: 'Posto avançado cadastrado com sucesso.',
    outpost,
  }
}

export const outpostCreateUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
