// src/models/occurrence/early-checkout-list-use-case.ts
import { ForbiddenErrorSchema } from '@/@types/http-errors-schema'
import { ForbiddenError } from '@/infra/errors'
import { EarlyCheckoutFilters } from '@/repositories/base/space-check-in-out-repository'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  EarlyCheckoutListQueryInput,
  EarlyCheckoutListResponse,
} from '@/schemas/occurrence/early-checkout-list-schema'
import { FastifyRequest } from 'fastify'

// ========================================
// 📌 INTERFACES
// ========================================

interface Dependencies {
  spaceCheckInOutRepository: PgSpaceCheckInOutRepository
  teamPositionsRepository: PgTeamPositionsRepository
}

export interface EarlyCheckoutListInput {
  request: FastifyRequest
  query: EarlyCheckoutListQueryInput
}

// ========================================
// 📌 USE CASE
// ========================================

/**
 * Use Case: Listar ocorrências de checkout antecipado
 *
 * Regras de negócio:
 * 1. Admin e Dev (roles) podem ver todas as ocorrências
 * 2. Director (position no team) pode ver todas as ocorrências
 * 3. Supervisor (position no team) pode ver apenas ocorrências da sua equipe
 * 4. Outros usuários não têm acesso
 * 5. Sempre busca da pendência mais antiga até hoje (sem filtro de data)
 * 6. Retorna indicadores, período e lista paginada
 */
export async function earlyCheckoutListUseCase(
  { request, query }: EarlyCheckoutListInput,
  deps: Dependencies,
): Promise<EarlyCheckoutListResponse> {
  const userId = request.requestContext.get('userId') as string
  const userRole = request.requestContext.get('userRole') as string

  // 📌 Verificar permissões
  // Admin e Dev (roles do sistema) têm acesso total
  const isAdminOrDev = ['admin', 'dev'].includes(userRole)

  // Buscar position do usuário no team (director, supervisor, manager, etc)
  const userPosition = await deps.teamPositionsRepository.findByUserId(userId)
  const positionType = userPosition?.position ?? null

  // Director (position) também tem acesso total
  const isDirector = positionType === 'director'

  // Supervisor (position) tem acesso apenas à sua equipe
  const isSupervisor = positionType === 'supervisor'

  // Verificar se tem permissão de acesso
  const hasFullAccess = isAdminOrDev || isDirector
  const hasTeamAccess = isSupervisor

  if (!hasFullAccess && !hasTeamAccess) {
    throw new ForbiddenError({
      message: 'Você não tem permissão para visualizar ocorrências',
      action:
        'Apenas supervisores e níveis superiores podem acessar este recurso',
      details: {
        where: 'occurrence.earlyCheckoutList',
        userId,
        userRole,
        userPosition: positionType,
        reason: 'insufficient_permission',
      },
    })
  }

  // 📌 Montar filtros
  const filters: EarlyCheckoutFilters = {
    status: query.status,
    supervisorName: query.supervisorName,
    userName: query.userName,
    userEmail: query.userEmail,
    position: query.position,
  }

  // Se for apenas supervisor (sem acesso total), buscar apenas ocorrências da sua equipe
  if (!hasFullAccess && hasTeamAccess) {
    const teamUserIds =
      await deps.spaceCheckInOutRepository.getTeamUserIdsBySupervisor(userId)
    filters.teamUserIds = teamUserIds
  }

  // 📌 Buscar indicadores (totais sem paginação)
  const indicators =
    await deps.spaceCheckInOutRepository.getEarlyCheckoutIndicators(filters)

  // 📌 Buscar período (data da pendência mais antiga)
  const oldestPendingDate =
    await deps.spaceCheckInOutRepository.getOldestPendingEarlyCheckoutDate(
      filters.teamUserIds,
    )

  // 📌 Buscar ocorrências paginadas
  const { occurrences, totalItems } =
    await deps.spaceCheckInOutRepository.listEarlyCheckoutOccurrences({
      ...filters,
      page: query.page,
      pageSize: query.pageSize,
    })

  // 📌 Calcular paginação
  const totalPages = Math.ceil(totalItems / query.pageSize)

  // 📌 Formatar resposta
  return {
    period: {
      start: oldestPendingDate ? oldestPendingDate.toISOString() : null,
      end: new Date().toISOString(),
    },
    indicators: {
      total: indicators.total,
      pending: indicators.pending,
      justified: indicators.justified,
      dismissed: indicators.dismissed,
    },
    occurrences: occurrences.map((occ) => ({
      id: occ.id,
      userId: occ.userId,
      userName: occ.userName,
      userEmail: occ.userEmail,
      userAvatar: occ.userAvatar,
      position: occ.position,
      supervisorId: occ.supervisorId,
      supervisorName: occ.supervisorName,
      supervisorEmail: occ.supervisorEmail,
      checkInAt: occ.checkInAt,
      checkOutAt: occ.checkOutAt,
      workedHours: occ.workedHours,
      status: occ.status,
      justification: occ.justification,
      justifiedByName: occ.justifiedByName,
      justifiedAt: occ.justifiedAt,
      spaceId: occ.spaceId,
      spaceName: occ.spaceName,
      reservationId: occ.reservationId,
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
    message:
      totalItems > 0
        ? `${totalItems} ocorrência(s) encontrada(s)`
        : 'Nenhuma ocorrência encontrada',
  }
}

export const earlyCheckoutListUseCaseSchema = {
  403: ForbiddenErrorSchema,
}
