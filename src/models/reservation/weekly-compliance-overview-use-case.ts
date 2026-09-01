// src/models/reservation/weekly-compliance-overview-use-case.ts
import { BadRequestErrorSchema } from '@/@types/http-errors-schema'
import { IOutpostsRepository } from '@/repositories/base/outposts-repository'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { WeeklyComplianceOverviewResponse } from '@/schemas/reservation/weekly-compliance-overview-schema'
import { getNextWeekRange, getRequiredDaysByPosition } from '@/utils/date-utils'
import { FastifyRequest } from 'fastify'

export interface GetWeeklyComplianceOverviewInput {
  request: FastifyRequest
}

interface Dependencies {
  spaceReservationRepository: ISpaceReservationRepository
  teamPositionsRepository: ITeamPositionsRepository
  outpostsRepository: IOutpostsRepository
}

/**
 * Use Case: Buscar overview de compliance de reservas semanais
 *
 * Regras de negócio:
 * 1. Busca a posição do usuário autenticado
 * 2. Se for colaborador (manager, assistant_manager, assistant): retorna status individual
 * 3. Se for supervisor: retorna resumo da equipe
 * 4. Se for diretor: retorna resumo geral
 * 5. Calcula automaticamente a próxima semana útil (segunda a sexta)
 */
export async function getWeeklyComplianceOverviewUseCase(
  { request }: GetWeeklyComplianceOverviewInput,
  deps: Dependencies,
): Promise<WeeklyComplianceOverviewResponse> {
  // 📌 Extrai o userId e role do contexto da requisição
  const userId = request.requestContext.get('userId') as string
  const userRole = request.requestContext.get('userRole') as string

  // 📌 Busca a posição do usuário
  const position = await deps.teamPositionsRepository.findByUserId(userId)

  // 📌 Calcula o range da próxima semana útil
  const { startDate, endDate } = getNextWeekRange()

  // 📌 Admin e Dev: retorna resumo geral (mesma visão do diretor)
  if (userRole === 'admin' || userRole === 'dev') {
    const allMembers =
      await deps.spaceReservationRepository.listNonCompliantUsers(
        startDate,
        endDate,
        undefined, // sem filtro de supervisor = todos
      )

    const totalMembers = allMembers.length
    const compliantMembers = allMembers.filter((m) => m.isCompliant).length
    const nonCompliantMembers = allMembers.filter((m) => !m.isCompliant).length

    return {
      userType: 'director',
      nextWeekStart: startDate.toISOString(),
      nextWeekEnd: endDate.toISOString(),
      overallSummary: {
        totalMembers,
        compliantMembers,
        nonCompliantMembers,
      },
    }
  }

  // 📌 Usuário sem posição ou assistente/subgerente/gerente (colaborador)
  if (
    !position ||
    position.position === 'assistant' ||
    position.position === 'assistant_manager' ||
    position.position === 'manager'
  ) {
    // Verificar se o usuário está em Posto Avançado (completamente isento de compliance)
    const isOnOutpost = await deps.outpostsRepository.isUserOnOutpost(userId)

    if (isOnOutpost) {
      // Usuário em posto avançado: isento de compliance
      return {
        userType: 'employee',
        nextWeekStart: startDate.toISOString(),
        nextWeekEnd: endDate.toISOString(),
        requiredDays: 0,
        reservedDays: 0,
        isCompliant: true,
        missingDays: 0,
      }
    }

    const requiredDays = position
      ? getRequiredDaysByPosition(position.position)
      : 0

    // Conta quantos dias distintos o usuário já reservou workstations para a próxima semana
    const reservedDays =
      await deps.spaceReservationRepository.countUserWorkstationDaysByDateRange(
        userId,
        startDate,
        endDate,
      )

    const isCompliant = reservedDays >= requiredDays
    const missingDays = Math.max(0, requiredDays - reservedDays)

    return {
      userType: 'employee',
      nextWeekStart: startDate.toISOString(),
      nextWeekEnd: endDate.toISOString(),
      requiredDays,
      reservedDays,
      isCompliant,
      missingDays,
    }
  }

  // 📌 Supervisor: retorna resumo da equipe
  if (position.position === 'supervisor') {
    const teamMembers =
      await deps.spaceReservationRepository.listNonCompliantUsers(
        startDate,
        endDate,
        position.id, // ID da posição do supervisor
      )

    const totalMembers = teamMembers.length
    const compliantMembers = teamMembers.filter((m) => m.isCompliant).length
    const nonCompliantMembers = teamMembers.filter((m) => !m.isCompliant).length

    return {
      userType: 'supervisor',
      nextWeekStart: startDate.toISOString(),
      nextWeekEnd: endDate.toISOString(),
      teamSummary: {
        totalMembers,
        compliantMembers,
        nonCompliantMembers,
      },
    }
  }

  // 📌 Diretor: retorna resumo geral
  if (position.position === 'director') {
    const allMembers =
      await deps.spaceReservationRepository.listNonCompliantUsers(
        startDate,
        endDate,
        undefined, // sem filtro de supervisor = todos
      )

    const totalMembers = allMembers.length
    const compliantMembers = allMembers.filter((m) => m.isCompliant).length
    const nonCompliantMembers = allMembers.filter((m) => !m.isCompliant).length

    return {
      userType: 'director',
      nextWeekStart: startDate.toISOString(),
      nextWeekEnd: endDate.toISOString(),
      overallSummary: {
        totalMembers,
        compliantMembers,
        nonCompliantMembers,
      },
    }
  }

  // Fallback: tratar como employee sem posição
  return {
    userType: 'employee',
    nextWeekStart: startDate.toISOString(),
    nextWeekEnd: endDate.toISOString(),
    requiredDays: 0,
    reservedDays: 0,
    isCompliant: true,
    missingDays: 0,
  }
}

export const getWeeklyComplianceOverviewUseCaseSchema = {
  400: BadRequestErrorSchema,
}
