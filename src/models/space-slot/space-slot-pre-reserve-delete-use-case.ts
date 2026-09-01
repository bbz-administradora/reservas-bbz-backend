// src/models/space-slot/space-slot-pre-reserve-delete-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'

export interface DeleteSpaceSlotPreReserveInput {
  slotId: string
  userId: string
  userRole: string // Papel do usuário (admin, dev, ou user)
}

interface Dependencies {
  spaceSlotRepository: PgSpaceSlotRepository
}

export async function deleteSpaceSlotPreReserve(
  { slotId, userId, userRole }: DeleteSpaceSlotPreReserveInput,
  deps: Dependencies,
) {
  // Verificar se o slot existe
  const slot = await deps.spaceSlotRepository.findById(slotId)

  if (!slot) {
    throw new NotFoundError({
      message: 'Slot não encontrado',
      action: 'Verifique o ID do slot e tente novamente',
      details: {
        where: 'spaceSlot.deletePreReserve',
        slotId,
        userId,
      },
    })
  }

  // Verificar se o slot está em estado de pré-reserva
  if (slot.status !== 'pre_reserved') {
    throw new BadRequestError({
      message: 'Slot não está em estado de pré-reserva',
      action: 'Apenas slots pré-reservados podem ser deletados',
      details: {
        where: 'spaceSlot.deletePreReserve',
        slotId,
        currentStatus: slot.status,
        expectedStatus: 'pre_reserved',
        reason: 'invalid_slot_status',
      },
    })
  }

  // Verificar se o usuário é o dono da pré-reserva ou um admin/dev
  const userIsOwner = slot.userId === userId

  // Usuários com perfil admin/dev podem cancelar qualquer pré-reserva
  const userIsAdminOrDev = userRole === 'admin' || userRole === 'dev'

  if (!userIsOwner && !userIsAdminOrDev) {
    throw new ForbiddenError({
      message: 'Sem permissão para deletar esta pré-reserva',
      action:
        'Apenas o criador da pré-reserva ou administradores podem deletar',
      details: {
        where: 'spaceSlot.deletePreReserve',
        slotId,
        requestingUserId: userId,
        slotOwnerId: slot.userId,
        userRole,
        reason: 'insufficient_permissions',
      },
    })
  }

  await deps.spaceSlotRepository.deleteById(slotId)

  return {
    message: 'Pré-reserva cancelada com sucesso',
    slotId: slotId,
  }
}

export const deleteSpaceSlotPreReserveSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
