// src/models/user/booking-exception-use-case.ts
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
  BookingExceptionBodyInput,
  BookingExceptionParamsInput,
  BookingExceptionResponse,
} from '@/schemas/user/booking-exception-schema'
import { endOfWeek } from 'date-fns'

export interface BookingExceptionInput {
  params: BookingExceptionParamsInput
  body: BookingExceptionBodyInput
  /** Dados do usuário autenticado que está fazendo a requisição */
  requestUser: {
    id: string
    role: 'dev' | 'admin' | 'user'
    teamPosition:
      | 'director'
      | 'supervisor'
      | 'manager'
      | 'assistant_manager'
      | 'assistant'
      | null
  }
}

interface Dependencies {
  usersRepository: IUserRepository
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Calcula o sábado da semana atual às 23:59:59.999
 * A semana vai de domingo a sábado.
 */
function getSaturdayEndOfWeek(referenceDate: Date = new Date()): Date {
  // endOfWeek com weekStartsOn: 0 retorna o sábado às 23:59:59.999
  return endOfWeek(referenceDate, { weekStartsOn: 0 })
}

/**
 * Verifica se o usuário autenticado pode conceder/revogar exceção para o usuário alvo.
 *
 * Permissões:
 * - Admin/Dev: Qualquer usuário com posição em time
 * - Diretor: Qualquer usuário com posição em time
 * - Supervisor: Apenas membros da própria equipe
 */
async function canGrantException(
  requestUser: BookingExceptionInput['requestUser'],
  targetUserId: string,
  deps: Dependencies,
): Promise<{ allowed: boolean; reason?: string }> {
  // Admin/Dev pode conceder para qualquer um
  if (['admin', 'dev'].includes(requestUser.role)) {
    return { allowed: true }
  }

  // Diretor pode conceder para qualquer um
  if (requestUser.teamPosition === 'director') {
    return { allowed: true }
  }

  // Supervisor só pode conceder para membros da própria equipe
  if (requestUser.teamPosition === 'supervisor') {
    // Buscar a posição do supervisor (para pegar o ID da posição)
    const supervisorPosition = await deps.teamPositionsRepository.findByUserId(
      requestUser.id,
    )

    if (!supervisorPosition) {
      return {
        allowed: false,
        reason: 'Você não possui uma posição válida na hierarquia.',
      }
    }

    // Buscar os subordinados do supervisor (recursivamente - toda a hierarquia)
    const subordinates =
      await deps.teamMemberSupervisorsRepository.listAllSubordinatesRecursive(
        supervisorPosition.id,
      )

    // Verificar se o usuário alvo é um subordinado (direto ou indireto)
    const isSubordinate = subordinates.some(
      (sub) => sub.subordinateUserId === targetUserId,
    )

    if (!isSubordinate) {
      return {
        allowed: false,
        reason:
          'Você só pode conceder exceção para membros da sua própria equipe.',
      }
    }

    return { allowed: true }
  }

  // Outros cargos não podem conceder exceção
  return {
    allowed: false,
    reason: 'Você não tem permissão para conceder exceções de prazo.',
  }
}

export async function bookingExceptionUseCase(
  input: BookingExceptionInput,
  deps: Dependencies,
): Promise<BookingExceptionResponse> {
  const { params, body, requestUser } = input
  const { userId } = params
  const { active } = body

  // Verificar se o usuário alvo existe
  const targetUser = await deps.usersRepository.findById(userId)

  if (!targetUser) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action: 'Verifique o ID do usuário e tente novamente',
      details: {
        where: 'user.bookingException',
        targetUserId: userId,
      },
    })
  }

  // Verificar se o usuário alvo está ativo
  if (!targetUser.accountStatus) {
    throw new BadRequestError({
      message: 'Não é possível conceder exceção para usuário inativo',
      action: 'O usuário deve ter uma conta ativa para receber exceção',
      details: {
        where: 'user.bookingException',
        targetUserId: userId,
        accountStatus: targetUser.accountStatus,
      },
    })
  }

  // Verificar se o usuário alvo tem posição em time
  const targetPosition = await deps.teamPositionsRepository.findByUserId(userId)

  if (!targetPosition) {
    throw new BadRequestError({
      message: 'Usuário não possui uma posição na equipe',
      action:
        'Apenas usuários com posição na hierarquia podem receber exceção de prazo',
      details: {
        where: 'user.bookingException',
        targetUserId: userId,
        hasTeamPosition: false,
      },
    })
  }

  // Verificar permissão
  const permission = await canGrantException(requestUser, userId, deps)

  if (!permission.allowed) {
    throw new ForbiddenError({
      message: permission.reason || 'Sem permissão para esta operação',
      action: 'Você não tem permissão para conceder exceção para este usuário',
      details: {
        where: 'user.bookingException',
        requestUserId: requestUser.id,
        requestUserRole: requestUser.role,
        requestUserPosition: requestUser.teamPosition,
        targetUserId: userId,
      },
    })
  }

  // Calcular a data de expiração (sábado da semana às 23:59:59.999)
  const exceptionUntil = active ? getSaturdayEndOfWeek() : null

  // Atualizar o usuário
  const updatedUser = await deps.usersRepository.update({
    id: userId,
    bookingExceptionUntil: exceptionUntil,
  })

  const actionMessage = active
    ? `Exceção de prazo concedida até ${exceptionUntil?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`
    : 'Exceção de prazo removida'

  return {
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      bookingExceptionUntil: updatedUser.bookingExceptionUntil,
    },
    message: actionMessage,
  }
}

export const bookingExceptionUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
