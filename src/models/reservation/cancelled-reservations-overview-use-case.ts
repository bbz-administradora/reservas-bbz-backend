// src/models/reservation/cancelled-reservations-overview-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError } from '@/infra/errors'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import {
  CancelledReservationsOverviewQuery,
  CancelledReservationsOverviewResponse,
} from '@/schemas/reservation/cancelled-reservations-overview-schema'
import { startOfMonth } from 'date-fns'
import { FastifyRequest } from 'fastify'

export interface GetCancelledReservationsOverviewInput {
  request: FastifyRequest
  query: CancelledReservationsOverviewQuery
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
  teamPositionsRepository: ITeamPositionsRepository
}

/**
 * Use Case: Buscar overview de cancelamentos de reservas após o prazo de planejamento
 *
 * Regras de negócio:
 * 1. Admin e Dev (roles) podem ver todos os cancelamentos
 * 2. Director (position) pode ver todos os cancelamentos
 * 3. Supervisor (position) pode ver apenas cancelamentos da sua equipe
 * 4. Outros usuários não têm acesso
 * 5. Se não informar período, busca do início do mês atual até agora
 */
export async function getCancelledReservationsOverviewUseCase(
  { request, query }: GetCancelledReservationsOverviewInput,
  deps: Dependencies,
): Promise<CancelledReservationsOverviewResponse> {
  // 📌 Extrai o userId e role do contexto da requisição
  const userId = request.requestContext.get('userId') as string
  const userRole = request.requestContext.get('userRole') as string

  // 📌 Admin e Dev (roles do sistema) têm acesso total
  const isAdminOrDev = ['admin', 'dev'].includes(userRole)

  // 📌 Busca a posição do usuário no team (director, supervisor, etc)
  const position = await deps.teamPositionsRepository.findByUserId(userId)
  const positionType = position?.position ?? null

  // 📌 Director (position) também tem acesso total
  const isDirector = positionType === 'director'

  // 📌 Supervisor (position) tem acesso apenas à sua equipe
  const isSupervisor = positionType === 'supervisor'

  // 📌 Verifica se tem permissão de acesso
  const hasFullAccess = isAdminOrDev || isDirector
  const hasTeamAccess = isSupervisor

  if (!hasFullAccess && !hasTeamAccess) {
    throw new ForbiddenError({
      message:
        'Você não tem permissão para visualizar cancelamentos de reservas.',
      action:
        'Apenas supervisores, diretores e administradores podem acessar este recurso.',
    })
  }

  // 📌 Define o período de busca
  const now = new Date()
  const periodStart = query.startDate
    ? new Date(query.startDate)
    : startOfMonth(now)
  const periodEnd = query.endDate ? new Date(query.endDate) : now

  // 📌 Valida as datas
  if (periodStart > periodEnd) {
    throw new BadRequestError({
      message: 'A data inicial não pode ser maior que a data final.',
      action: 'Corrija as datas do período e tente novamente.',
    })
  }

  // 📌 Monta os filtros com base no cargo
  const filters = {
    startDate: periodStart.toISOString(),
    endDate: periodEnd.toISOString(),
    // Supervisor: filtra pela sua posição (mostra apenas subordinados)
    // Admin/Dev/Director: não filtra (vê todos)
    supervisorPositionId: isSupervisor ? position!.id : undefined,
  }

  // 📌 Busca a contagem de cancelamentos
  const totalCancellations =
    await deps.spaceReservationRepository.countCancelledReservations(filters)

  // 📌 Define o userType para a resposta
  const userType = hasFullAccess ? 'director' : 'supervisor'

  return {
    userType,
    totalCancellations,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  }
}

/**
 * Schema de erros do use case para documentação OpenAPI
 */
export const getCancelledReservationsOverviewUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
}
