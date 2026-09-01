// src/models/outpost/outpost-update-use-case.ts

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
  OutpostUpdateBody,
  OutpostUpdateParams,
  OutpostUpdateResponse,
} from '@/schemas/outpost/outpost-schema'
import { FastifyRequest } from 'fastify'

export interface OutpostUpdateInput {
  request: FastifyRequest
  params: OutpostUpdateParams
  body: OutpostUpdateBody
}

interface Dependencies {
  outpostsRepository: IOutpostsRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Use Case: Atualizar posto avançado
 *
 * Regras de negócio:
 * 1. Admin/Dev: podem atualizar qualquer posto
 * 2. Diretor: pode atualizar qualquer posto
 * 3. Supervisor: pode atualizar apenas postos de membros da própria equipe
 * 4. Outros: não podem atualizar
 * 5. NÃO pode alterar userId (membro) nem startDate
 */
export async function outpostUpdateUseCase(
  { request, params, body }: OutpostUpdateInput,
  deps: Dependencies,
): Promise<OutpostUpdateResponse> {
  const requestUserId = request.requestContext.get('userId') as string
  const requestUserRole = request.requestContext.get('userRole') as string

  const { id } = params
  const { clientName, clientAddress, endDate, weekdays } = body

  // 📌 Verifica se o posto existe
  const existingOutpost = await deps.outpostsRepository.findById(id)
  if (!existingOutpost) {
    throw new NotFoundError({
      message: 'Posto avançado não encontrado.',
      action: 'Verifique se o ID do posto está correto.',
    })
  }

  // 📌 Validação de weekdays
  if (weekdays !== undefined && weekdays.length === 0) {
    throw new BadRequestError({
      message: 'Selecione pelo menos um dia da semana.',
      action: 'Escolha os dias em que o colaborador estará no posto avançado.',
    })
  }

  // 📌 Validação de datas (se end_date informada, deve ser >= start_date)
  if (endDate) {
    const start = new Date(existingOutpost.startDate)
    const end = new Date(endDate)

    if (start > end) {
      throw new BadRequestError({
        message: 'A data fim não pode ser anterior à data de início.',
        action: 'Corrija a data fim e tente novamente.',
      })
    }
  }

  // 📌 Verificar permissões
  const isAdminOrDev = ['admin', 'dev'].includes(requestUserRole)

  const requestUserPosition =
    await deps.teamPositionsRepository.findByUserId(requestUserId)
  const isDirector = requestUserPosition?.position === 'director'
  const isSupervisor = requestUserPosition?.position === 'supervisor'

  // Admin, Dev e Diretor podem atualizar qualquer posto
  if (!isAdminOrDev && !isDirector) {
    if (!isSupervisor) {
      throw new ForbiddenError({
        message: 'Você não tem permissão para editar postos avançados.',
        action:
          'Apenas supervisores, diretores e administradores podem editar postos avançados.',
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
            'Você só pode editar postos avançados de membros da sua equipe.',
          action:
            'Verifique se o usuário pertence à sua equipe ou solicite a um administrador.',
        })
      }
    }
  }

  // 📌 Atualizar posto avançado
  const updatedOutpost = await deps.outpostsRepository.update({
    id,
    clientName,
    clientAddress,
    endDate,
    weekdays,
  })

  return {
    message: 'Posto avançado atualizado com sucesso.',
    outpost: updatedOutpost,
  }
}

export const outpostUpdateUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
