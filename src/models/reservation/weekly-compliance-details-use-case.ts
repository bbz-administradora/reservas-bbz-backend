// src/models/reservation/weekly-compliance-details-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
} from '@/@types/http-errors-schema'
import { ForbiddenError } from '@/infra/errors'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import {
  PositionStats,
  SupervisorFilter,
  WeeklyComplianceDetailsResponse,
} from '@/schemas/reservation/weekly-compliance-details-schema'
import { getCurrentWeekRange, getNextWeekRange } from '@/utils/date-utils'
import { FastifyRequest } from 'fastify'

export interface GetWeeklyComplianceDetailsInput {
  request: FastifyRequest
  page: number
  pageSize: number
  onlyNonCompliant: boolean
  week: 'next' | 'current'
  supervisorName?: string
  userName?: string
  position?: string
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
  teamPositionsRepository: ITeamPositionsRepository
}

/**
 * Use Case: Buscar detalhes de compliance de reservas semanais
 *
 * Regras de negócio:
 * 1. Apenas supervisor e diretor podem acessar
 * 2. Supervisor vê apenas membros da sua equipe
 * 3. Diretor vê todos os colaboradores
 * 4. Retorna lista paginada de membros com status de compliance
 */
export async function getWeeklyComplianceDetailsUseCase(
  {
    request,
    page,
    pageSize,
    onlyNonCompliant,
    week,
    supervisorName,
    userName,
    position: positionFilter,
  }: GetWeeklyComplianceDetailsInput,
  deps: Dependencies,
): Promise<WeeklyComplianceDetailsResponse> {
  // 📌 Extrai o userId e role do contexto da requisição
  const userId = request.requestContext.get('userId') as string
  const userRole = request.requestContext.get('userRole') as string

  // 📌 Busca a posição do usuário
  const position = await deps.teamPositionsRepository.findByUserId(userId)

  // 📌 Validação: admin e dev podem acessar, ou supervisor/diretor
  const isAdminOrDev = userRole === 'admin' || userRole === 'dev'
  const isSupervisorOrDirector =
    position !== null &&
    (position.position === 'supervisor' || position.position === 'director')

  if (!isAdminOrDev && !isSupervisorOrDirector) {
    throw new ForbiddenError({
      message:
        'Acesso negado. Apenas supervisores, diretores, administradores e desenvolvedores podem visualizar os detalhes de compliance.',
      action:
        'Verifique se você possui o cargo de supervisor ou diretor, ou a role de admin/dev para acessar este recurso.',
      details: {
        where: 'weeklyComplianceDetails.getDetails',
        userId,
        userRole,
        userPosition: position?.position || null,
        allowedPositions: ['supervisor', 'director'],
        allowedRoles: ['admin', 'dev'],
        reason: 'insufficient_position_level',
      },
    })
  }

  // 📌 Calcula o range da semana (vigente ou próxima)
  const { startDate, endDate } =
    week === 'current' ? getCurrentWeekRange() : getNextWeekRange()

  // 📌 Busca os membros com status de compliance
  // Se for supervisor, filtra por sua equipe (passando positionId)
  // Se for diretor/admin/dev, busca todos (sem filtro)
  const supervisorPositionId =
    position?.position === 'supervisor' ? position.id : undefined

  // 📌 Se for semana corrente, conta também reservas concluídas com check-out
  const isCurrentWeek = week === 'current'

  const allMembers =
    await deps.spaceReservationRepository.listNonCompliantUsers(
      startDate,
      endDate,
      supervisorPositionId,
      isCurrentWeek,
    )

  // 📌 Gera a lista de supervisores para filtro (apenas para diretores)
  // Agrupa os membros por supervisorName e conta quantos têm cada supervisor
  const supervisorsMap = new Map<
    string,
    { count: number; compliantCount: number; nonCompliantCount: number }
  >()
  for (const member of allMembers) {
    const supName = member.supervisorName || 'Sem supervisor'
    const current = supervisorsMap.get(supName) || {
      count: 0,
      compliantCount: 0,
      nonCompliantCount: 0,
    }
    current.count++
    if (member.isCompliant) {
      current.compliantCount++
    } else {
      current.nonCompliantCount++
    }
    supervisorsMap.set(supName, current)
  }
  const supervisors: SupervisorFilter[] = Array.from(supervisorsMap.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      compliantCount: stats.compliantCount,
      nonCompliantCount: stats.nonCompliantCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // 📌 Gera estatísticas agregadas por cargo
  const positionLabels: Record<string, string> = {
    director: 'Diretor',
    supervisor: 'Supervisor',
    manager: 'Gerente',
    assistant_manager: 'Subgerente',
    assistant: 'Assistente',
  }

  const positionsMap = new Map<
    string,
    { count: number; compliantCount: number; nonCompliantCount: number }
  >()
  for (const member of allMembers) {
    const pos = member.position
    const current = positionsMap.get(pos) || {
      count: 0,
      compliantCount: 0,
      nonCompliantCount: 0,
    }
    current.count++
    if (member.isCompliant) {
      current.compliantCount++
    } else {
      current.nonCompliantCount++
    }
    positionsMap.set(pos, current)
  }
  const positionStats: PositionStats[] = Array.from(positionsMap.entries())
    .map(([position, stats]) => ({
      position,
      label: positionLabels[position] || position,
      count: stats.count,
      compliantCount: stats.compliantCount,
      nonCompliantCount: stats.nonCompliantCount,
    }))
    .sort((a, b) => b.count - a.count) // Ordena por total decrescente

  // 📌 Aplica filtros adicionais
  let filteredMembers = allMembers

  // Filtro: apenas não-compliant
  if (onlyNonCompliant) {
    filteredMembers = filteredMembers.filter((m) => !m.isCompliant)
  }

  // Filtro: por nome do supervisor (busca parcial, case-insensitive)
  if (supervisorName) {
    const searchTerm = supervisorName.toLowerCase()
    filteredMembers = filteredMembers.filter((m) =>
      m.supervisorName?.toLowerCase().includes(searchTerm),
    )
  }

  // Filtro: por nome do colaborador (busca parcial, case-insensitive)
  if (userName) {
    const searchTerm = userName.toLowerCase()
    filteredMembers = filteredMembers.filter((m) =>
      m.userName?.toLowerCase().includes(searchTerm),
    )
  }

  // Filtro: por cargo
  if (positionFilter) {
    filteredMembers = filteredMembers.filter(
      (m) => m.position === positionFilter,
    )
  }

  // 📌 Calcula contadores totais (ANTES da paginação, usando allMembers)
  const compliantCount = allMembers.filter((m) => m.isCompliant).length
  const nonCompliantCount = allMembers.filter((m) => !m.isCompliant).length

  // 📌 Mapeia para adicionar o campo missingDays
  const membersWithMissingDays = filteredMembers.map((member) => ({
    ...member,
    missingDays: Math.max(0, member.requiredDays - member.reservedDays),
  }))

  // 📌 Aplica paginação
  const totalCount = membersWithMissingDays.length
  const totalPages = Math.ceil(totalCount / pageSize) || 1
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedMembers = membersWithMissingDays.slice(startIndex, endIndex)

  return {
    nextWeekStart: startDate.toISOString(),
    nextWeekEnd: endDate.toISOString(),
    members: paginatedMembers,
    supervisors,
    positionStats,
    totalCount,
    compliantCount,
    nonCompliantCount,
    totalPages,
    currentPage: page,
  }
}

export const getWeeklyComplianceDetailsUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
}
