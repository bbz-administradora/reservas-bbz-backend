// src/models/user/user-list-absences-use-case.ts
import { ForbiddenErrorSchema } from '@/@types/http-errors-schema'
import { ForbiddenError } from '@/infra/errors'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { IUserRepository } from '@/repositories/base/users-repository'
import {
  UserListAbsencesQuery,
  UserListAbsencesResponse,
} from '@/schemas/user/user-absence-schema'
import { FastifyRequest } from 'fastify'

export interface UserListAbsencesInput {
  request: FastifyRequest
  query: UserListAbsencesQuery
}

interface Dependencies {
  usersRepository: IUserRepository
  teamPositionsRepository: ITeamPositionsRepository
}

/**
 * Use Case: Listar usuários com afastamento
 *
 * Regras de negócio:
 * 1. Admin/Dev: veem todos os afastamentos
 * 2. Diretor: vê todos os afastamentos
 * 3. Supervisor: vê apenas afastamentos da própria equipe
 * 4. Outros: não têm acesso
 */
export async function userListAbsencesUseCase(
  { request, query }: UserListAbsencesInput,
  deps: Dependencies,
): Promise<UserListAbsencesResponse> {
  const requestUserId = request.requestContext.get('userId') as string
  const requestUserRole = request.requestContext.get('userRole') as string

  const { page, pageSize, includeExpired } = query

  // 📌 Verificar permissões
  const isAdminOrDev = ['admin', 'dev'].includes(requestUserRole)

  // Buscar posição do usuário que está fazendo a requisição
  const requestUserPosition =
    await deps.teamPositionsRepository.findByUserId(requestUserId)
  const isDirector = requestUserPosition?.position === 'director'
  const isSupervisor = requestUserPosition?.position === 'supervisor'

  if (!isAdminOrDev && !isDirector && !isSupervisor) {
    throw new ForbiddenError({
      message: 'Você não tem permissão para visualizar afastamentos.',
      action:
        'Apenas supervisores, diretores e administradores podem visualizar afastamentos.',
    })
  }

  // 📌 Supervisor vê apenas sua equipe
  const supervisorPositionId = isSupervisor
    ? requestUserPosition?.id
    : undefined

  // 📌 Buscar afastamentos
  const result = await deps.usersRepository.listUsersWithAbsence(
    page,
    pageSize,
    includeExpired,
    supervisorPositionId,
  )

  const totalPages = Math.ceil(result.total / pageSize)

  return {
    absences: result.users,
    total: result.total,
    page,
    pageSize,
    totalPages,
  }
}

export const userListAbsencesUseCaseSchema = {
  403: ForbiddenErrorSchema,
}
