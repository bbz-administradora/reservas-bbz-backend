// src/models/user/user-set-absence-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { IUserRepository } from '@/repositories/base/users-repository'
import {
  UserSetAbsenceBody,
  UserSetAbsenceParams,
  UserSetAbsenceResponse,
} from '@/schemas/user/user-absence-schema'
import { FastifyRequest } from 'fastify'

export interface UserSetAbsenceInput {
  request: FastifyRequest
  params: UserSetAbsenceParams
  body: UserSetAbsenceBody
}

interface Dependencies {
  usersRepository: IUserRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Use Case: Definir ou remover afastamento de um usuário
 *
 * Regras de negócio:
 * 1. Admin/Dev: podem definir afastamento para qualquer usuário
 * 2. Diretor: pode definir afastamento para qualquer usuário
 * 3. Supervisor: pode definir afastamento apenas para membros da própria equipe
 * 4. Outros: não podem definir afastamento
 * 5. Para remover afastamento, enviar startDate e endDate como null
 */
export async function userSetAbsenceUseCase(
  { request, params, body }: UserSetAbsenceInput,
  deps: Dependencies,
): Promise<UserSetAbsenceResponse> {
  const requestUserId = request.requestContext.get('userId') as string
  const requestUserRole = request.requestContext.get('userRole') as string

  const { userId } = params
  const { startDate, endDate } = body

  // 📌 Verifica se o usuário alvo existe
  const targetUser = await deps.usersRepository.findById(userId)
  if (!targetUser) {
    throw new NotFoundError({
      message: 'Usuário não encontrado.',
      action: 'Verifique se o ID do usuário está correto.',
    })
  }

  // 📌 Validação de datas
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      throw new BadRequestError({
        message: 'A data de início não pode ser posterior à data de fim.',
        action: 'Corrija as datas e tente novamente.',
      })
    }
  }

  // 📌 Verificar permissões
  const isAdminOrDev = ['admin', 'dev'].includes(requestUserRole)

  // Buscar posição do usuário que está fazendo a requisição
  const requestUserPosition =
    await deps.teamPositionsRepository.findByUserId(requestUserId)
  const isDirector = requestUserPosition?.position === 'director'
  const isSupervisor = requestUserPosition?.position === 'supervisor'

  // Admin, Dev e Diretor podem definir afastamento para qualquer usuário
  if (!isAdminOrDev && !isDirector) {
    // Supervisor só pode definir afastamento para sua equipe
    if (!isSupervisor) {
      throw new ForbiddenError({
        message: 'Você não tem permissão para definir afastamentos.',
        action:
          'Apenas supervisores, diretores e administradores podem definir afastamentos.',
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
            'Você só pode definir afastamento para membros da sua equipe.',
          action:
            'Verifique se o usuário pertence à sua equipe ou solicite a um administrador.',
        })
      }
    }
  }

  // 📌 Definir ou remover afastamento
  const updatedUser = await deps.usersRepository.setAbsence(
    userId,
    startDate,
    endDate,
    body.reason,
  )

  const action = startDate && endDate ? 'definido' : 'removido'

  return {
    message: `Afastamento ${action} com sucesso.`,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      absenceStartDate: updatedUser.absenceStartDate,
      absenceEndDate: updatedUser.absenceEndDate,
      absenceReason: updatedUser.absenceReason,
    },
  }
}

export const userSetAbsenceUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
