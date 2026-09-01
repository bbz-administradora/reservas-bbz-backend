// src/models/occurrence/early-checkout-justify-use-case.ts
import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { ForbiddenError, NotFoundError } from '@/infra/errors'
import { EarlyCheckoutStatus } from '@/repositories/base/space-check-in-out-repository'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  EarlyCheckoutJustifyBodyInput,
  EarlyCheckoutJustifyParamsInput,
  EarlyCheckoutJustifyResponse,
} from '@/schemas/occurrence/early-checkout-justify-schema'
import { FastifyRequest } from 'fastify'

// ========================================
// 📌 INTERFACES
// ========================================

interface Dependencies {
  spaceCheckInOutRepository: PgSpaceCheckInOutRepository
  teamPositionsRepository: PgTeamPositionsRepository
  usersRepository: PgUsersRepository
}

export interface EarlyCheckoutJustifyInput {
  request: FastifyRequest
  params: EarlyCheckoutJustifyParamsInput
  body: EarlyCheckoutJustifyBodyInput
}

// ========================================
// 📌 USE CASE
// ========================================

/**
 * Use Case: Justificar ou descartar ocorrência de checkout antecipado
 *
 * Regras de negócio:
 * 1. A ocorrência deve existir e estar com status 'pending'
 * 2. Admin e Dev podem justificar qualquer ocorrência
 * 3. Director pode justificar qualquer ocorrência
 * 4. Supervisor pode justificar apenas ocorrências de sua equipe
 * 5. Outros cargos não podem justificar
 */
export async function earlyCheckoutJustifyUseCase(
  { request, params, body }: EarlyCheckoutJustifyInput,
  deps: Dependencies,
): Promise<EarlyCheckoutJustifyResponse> {
  const userId = request.requestContext.get('userId') as string
  const userRole = request.requestContext.get('userRole') as string

  // 📌 Buscar a ocorrência
  const occurrence = await deps.spaceCheckInOutRepository.findEarlyCheckoutById(
    params.id,
  )

  if (!occurrence) {
    throw new NotFoundError({
      message: 'Ocorrência não encontrada',
      action:
        'Verifique se o ID informado está correto e se trata de um checkout antecipado',
      details: {
        where: 'occurrence.earlyCheckoutJustify',
        occurrenceId: params.id,
        reason: 'not_found',
      },
    })
  }

  // 📌 Verificar se já foi justificada
  if (occurrence.status !== 'pending') {
    throw new ForbiddenError({
      message: 'Esta ocorrência já foi processada',
      action: `A ocorrência já está com status '${occurrence.status}' e não pode ser alterada`,
      details: {
        where: 'occurrence.earlyCheckoutJustify',
        occurrenceId: params.id,
        currentStatus: occurrence.status,
        reason: 'already_processed',
      },
    })
  }

  // 📌 Verificar permissões
  const isPrivilegedRole = ['admin', 'dev'].includes(userRole)

  if (!isPrivilegedRole) {
    // Buscar position do usuário que está justificando
    const justifierPosition =
      await deps.teamPositionsRepository.findByUserId(userId)

    // Se não tem position, não pode justificar
    if (!justifierPosition) {
      throw new ForbiddenError({
        message: 'Você não tem permissão para justificar ocorrências',
        action:
          'Apenas supervisores, diretores e administradores podem justificar',
        details: {
          where: 'occurrence.earlyCheckoutJustify',
          userId,
          reason: 'no_position',
        },
      })
    }

    const position = justifierPosition.position

    // Director pode justificar tudo
    if (position === 'director') {
      // OK, pode prosseguir
    } else if (position === 'supervisor') {
      // Supervisor só pode justificar sua equipe
      const teamUserIds =
        await deps.spaceCheckInOutRepository.getTeamUserIdsBySupervisor(userId)

      if (!teamUserIds.includes(occurrence.userId)) {
        throw new ForbiddenError({
          message:
            'Você não tem permissão para justificar ocorrências deste colaborador',
          action:
            'Apenas o supervisor direto do colaborador pode justificar suas ocorrências',
          details: {
            where: 'occurrence.earlyCheckoutJustify',
            userId,
            collaboratorId: occurrence.userId,
            reason: 'not_supervisor_of_collaborator',
          },
        })
      }
    } else {
      // manager, assistant_manager, assistant não podem justificar
      throw new ForbiddenError({
        message: 'Você não tem permissão para justificar ocorrências',
        action:
          'Apenas supervisores, diretores e administradores podem justificar',
        details: {
          where: 'occurrence.earlyCheckoutJustify',
          userId,
          position,
          reason: 'insufficient_position',
        },
      })
    }
  }

  // 📌 Aplicar justificativa
  const newStatus: EarlyCheckoutStatus = body.action
  const justificationText =
    body.action === 'justified' ? (body.justification ?? null) : null

  await deps.spaceCheckInOutRepository.justifyEarlyCheckout({
    id: params.id,
    status: newStatus,
    justification: justificationText,
    justifiedBy: userId,
  })

  // 📌 Buscar dados atualizados para resposta
  const updatedOccurrence =
    await deps.spaceCheckInOutRepository.findEarlyCheckoutById(params.id)

  // Buscar nome do usuário que justificou
  const justifier = await deps.usersRepository.findById(userId)

  const actionLabel = body.action === 'justified' ? 'justificada' : 'descartada'

  return {
    occurrence: {
      id: params.id,
      userId: occurrence.userId,
      userName: occurrence.userName,
      status: newStatus,
      justification: justificationText,
      justifiedByName: justifier?.name ?? null,
      justifiedAt: updatedOccurrence?.justifiedAt ?? new Date().toISOString(),
    },
    message: `Ocorrência ${actionLabel} com sucesso`,
  }
}

export const earlyCheckoutJustifyUseCaseSchema = {
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
