// src/models/team/positions/remove-position-use-case.ts
import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { ForbiddenError, NotFoundError } from '@/infra/errors'
import { canRemove, getPositionLabel } from '@/models/team/nomination-rules'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  PositionType,
  RemovePositionParamsInput,
} from '@/schemas/team/positions'
import { FastifyRequest } from 'fastify'

interface Dependencies {
  teamPositionsRepository: PgTeamPositionsRepository
}

export interface RemovePositionInput {
  request: FastifyRequest
  params: RemovePositionParamsInput
}

/**
 * Use Case: Remover a posição de um usuário
 *
 * Regras de negócio:
 * 1. Verificar permissão de remoção baseado na hierarquia
 * 2. O usuário deve ter uma posição na equipe
 * 3. Ao remover, o usuário volta a ser um usuário comum (sem posição)
 */
export async function removePositionUseCase(
  { request, params }: RemovePositionInput,
  deps: Dependencies,
) {
  const { userId } = params

  // 📌 Obtém o usuário que está removendo
  const removerId = request.requestContext.get('userId') as string
  const removerRole = request.requestContext.get('userRole') as string

  // 📌 Verifica se o usuário alvo possui uma posição
  const existingPosition =
    await deps.teamPositionsRepository.findByUserId(userId)

  if (!existingPosition) {
    throw new NotFoundError({
      message: 'Este usuário não possui nenhuma posição na equipe',
      action: 'Verifique se o ID do usuário está correto.',
      details: {
        where: 'team.removePosition',
        targetUserId: userId,
        removerId,
      },
    })
  }

  const targetPosition = existingPosition.position as PositionType
  const positionLabel = getPositionLabel(targetPosition)

  // 📌 Busca a posição do removedor (pode não ter)
  const removerPosition =
    await deps.teamPositionsRepository.findByUserId(removerId)
  const removerPositionType = removerPosition?.position as
    PositionType | undefined

  // 📌 Verifica se foi nomeado pelo removedor
  const wasAssignedByRemover = existingPosition.assignedBy === removerId

  // 📌 Verifica se pode remover
  if (
    !canRemove(
      removerRole,
      removerPositionType ?? null,
      targetPosition,
      wasAssignedByRemover,
    )
  ) {
    throw new ForbiddenError({
      message: `Você não tem permissão para remover este ${positionLabel}`,
      action:
        'Você só pode remover membros que você nomeou ou que estão abaixo de você na hierarquia.',
      details: {
        where: 'team.removePosition',
        removerId,
        removerRole,
        removerPosition: removerPositionType ?? null,
        targetUserId: userId,
        targetPosition,
        wasAssignedByRemover,
        reason: 'insufficient_permission_to_remove',
      },
    })
  }

  // 📌 Remove a posição
  await deps.teamPositionsRepository.deleteByUserId(userId)

  return {
    message: `${positionLabel} removido(a) com sucesso. O usuário agora é um usuário comum.`,
    userId,
    positionRemoved: targetPosition,
  }
}

export const removePositionUseCaseSchema = {
  404: NotFoundErrorSchema,
  403: ForbiddenErrorSchema,
}
