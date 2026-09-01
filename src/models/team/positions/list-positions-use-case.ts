// src/models/team/positions/list-positions-use-case.ts
import { ForbiddenErrorSchema } from '@/@types/http-errors-schema'
import { ForbiddenError } from '@/infra/errors'
import {
  canList,
  getPositionLabel,
  getPositionLabelPlural,
} from '@/models/team/nomination-rules'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  ListPositionsParamsInput,
  PositionType,
} from '@/schemas/team/positions'
import { FastifyRequest } from 'fastify'

interface Dependencies {
  teamPositionsRepository: PgTeamPositionsRepository
}

export interface ListPositionsInput {
  request: FastifyRequest
  params: ListPositionsParamsInput
}

/**
 * Use Case: Listar todos os membros de uma posição
 *
 * Regras de negócio:
 * 1. Verificar permissão de listagem baseado na hierarquia
 * 2. Retorna todos os usuários com a posição especificada
 * 3. Inclui dados do usuário e de quem o nomeou
 */
export async function listPositionsUseCase(
  { request, params }: ListPositionsInput,
  deps: Dependencies,
) {
  const { position } = params
  const positionLabelPlural = getPositionLabelPlural(position)

  // 📌 Obtém o usuário que está listando
  const listerId = request.requestContext.get('userId') as string
  const listerRole = request.requestContext.get('userRole') as string

  // 📌 Busca a posição do listador (pode não ter)
  const listerPosition =
    await deps.teamPositionsRepository.findByUserId(listerId)
  const listerPositionType = listerPosition?.position as
    PositionType | undefined

  // 📌 Verifica se pode listar esta posição
  if (!canList(listerRole, listerPositionType ?? null, position)) {
    throw new ForbiddenError({
      message: `Você não tem permissão para listar ${positionLabelPlural}`,
      action: 'Verifique as regras de hierarquia.',
      details: {
        where: 'team.listPositions',
        listerId,
        listerRole,
        listerPosition: listerPositionType ?? null,
        targetPosition: position,
        reason: 'insufficient_permission_to_list',
      },
    })
  }

  // 📌 Busca todos os membros da posição
  const positions = await deps.teamPositionsRepository.listByPosition(position)

  return {
    positions: positions.map((p) => ({
      id: p.id,
      userId: p.userId,
      type: position,
      level: p.level,
      userName: p.userName,
      userEmail: p.userEmail,
      userAvatar: p.userAvatar,
      assignedByName: p.assignedByName,
      assignedByEmail: p.assignedByEmail,
      createdAt: p.createdAt,
    })),
    total: positions.length,
    message:
      positions.length > 0
        ? `${positions.length} ${positions.length === 1 ? getPositionLabel(position) : positionLabelPlural} encontrado(s)`
        : `Nenhum ${getPositionLabel(position)} nomeado ainda`,
  }
}

export const listPositionsUseCaseSchema = {
  403: ForbiddenErrorSchema,
}
