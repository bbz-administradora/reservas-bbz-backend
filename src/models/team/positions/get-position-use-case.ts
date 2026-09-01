// src/models/team/positions/get-position-use-case.ts
import { getPositionLabel } from '@/models/team/nomination-rules'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { GetPositionParamsInput, PositionType } from '@/schemas/team/positions'

interface Dependencies {
  teamPositionsRepository: PgTeamPositionsRepository
}

export interface GetPositionInput {
  params: GetPositionParamsInput
}

/**
 * Use Case: Buscar a posição de um usuário específico
 *
 * Regras de negócio:
 * 1. Qualquer usuário autenticado pode buscar
 * 2. Retorna a posição do usuário ou null se não tiver
 */
export async function getPositionUseCase(
  { params }: GetPositionInput,
  deps: Dependencies,
) {
  const { userId } = params

  // 📌 Busca a posição do usuário com dados completos
  const position =
    await deps.teamPositionsRepository.findByUserIdWithUser(userId)

  if (!position) {
    return {
      position: null,
      message: 'Este usuário não possui nenhuma posição na equipe',
    }
  }

  return {
    position: {
      id: position.id,
      userId: position.userId,
      type: position.position as PositionType,
      level: position.level,
      userName: position.userName,
      userEmail: position.userEmail,
      userAvatar: position.userAvatar,
      assignedByName: position.assignedByName,
      assignedByEmail: position.assignedByEmail,
      createdAt: position.createdAt,
    },
    message: `Usuário possui a posição de ${getPositionLabel(position.position as PositionType)}`,
  }
}

export const getPositionUseCaseSchema = {}
