// src/models/reservation/space-reservation-check-in-out-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { SpaceCheckInOut } from '@/repositories/base/space-check-in-out-repository'
import { UserAccountContext } from '@/repositories/base/users-repository'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import {
  ReservationCheckInOutBodyInput,
  ReservationCheckInOutParamsInput,
  ReservationCheckInOutResponse,
} from '@/schemas/reservation/space-reservation-check-in-out-schema'
import { addHours, addMinutes, isSameDay, parseISO } from 'date-fns'

// ========================================
// 📌 CONSTANTES DE REGRAS DE NEGÓCIO
// ========================================

// Tolerância de check-in para workstation: 15 minutos antes até 3 horas depois do horário de início
const WORKSTATION_CHECK_IN_TOLERANCE_MINUTES_BEFORE = 15
const WORKSTATION_CHECK_IN_TOLERANCE_HOURS_AFTER = 4

// Tolerância de check-in para room: 15 minutos antes até 1 hora depois do horário de início
const ROOM_CHECK_IN_TOLERANCE_MINUTES_BEFORE = 15
const ROOM_CHECK_IN_TOLERANCE_HOURS_AFTER = 1

// Jornada mínima para workstation: 9 horas (540 minutos)
// Com tolerância de 15 minutos: 8h45 (525 minutos)
const WORKSTATION_MINIMUM_JOURNEY_MINUTES = 525

// ========================================
// 📌 INTERFACES
// ========================================

interface InputProps {
  user: UserAccountContext
  params: ReservationCheckInOutParamsInput
  body: ReservationCheckInOutBodyInput
}

interface Dependencies {
  spaceReservationRepository: PgSpaceReservationRepository
  spaceCheckInOutRepository: PgSpaceCheckInOutRepository
  spacesRepository: PgSpacesRepository
  spaceSlotRepository: PgSpaceSlotRepository
}

// ========================================
// 📌 FUNÇÕES AUXILIARES
// ========================================

/**
 * Valida se o usuário tem permissão para fazer check-in/out na reserva
 */
function validateUserPermission(
  reservation: any,
  user: UserAccountContext,
): void {
  const isUserOwner = reservation.user.id === user.id
  const isUserBBZGuest = reservation.bbzCollaborators.includes(user.email)
  const isUserExternalGuest = reservation.externalGuests.includes(user.email)

  if (!isUserOwner && !isUserBBZGuest && !isUserExternalGuest) {
    throw new ForbiddenError({
      message:
        'Você não tem permissão para fazer check-in/check-out nesta reserva',
      action: 'Verifique se você é o proprietário da reserva ou foi convidado',
      details: {
        where: 'reservation.checkInOut',
        reservationId: reservation.id,
        reservationOwnerId: reservation.user.id,
        userId: user.id,
        userEmail: user.email,
        isUserOwner,
        isUserBBZGuest,
        isUserExternalGuest,
        bbzCollaborators: reservation.bbzCollaborators,
        externalGuests: reservation.externalGuests,
      },
    })
  }
}

/**
 * Executa a lógica de check-in
 */
async function executeCheckIn(
  reservation: any,
  space: any,
  user: UserAccountContext,
  deps: Dependencies,
): Promise<string> {
  // Verificar se o usuário já fez check-in
  const hasCheckIn = reservation.checkInOuts.some(
    (record: SpaceCheckInOut) =>
      record.type === 'check-in' && record.userId === user.id,
  )

  if (hasCheckIn) {
    throw new BadRequestError({
      message: 'Você já realizou check-in para esta reserva',
      action: 'Não é possível realizar múltiplos check-ins na mesma reserva',
      details: {
        where: 'reservation.checkInOut.checkIn',
        reservationId: reservation.id,
        userId: user.id,
        reason: 'already_checked_in',
      },
    })
  }

  // Validar janela de horário para check-in
  const currentDate = new Date()
  const startTime = parseISO(reservation.slotRange[0])

  // Definir tolerância baseada no tipo de espaço
  const toleranceMinutesBefore =
    space.type === 'workstation'
      ? WORKSTATION_CHECK_IN_TOLERANCE_MINUTES_BEFORE
      : ROOM_CHECK_IN_TOLERANCE_MINUTES_BEFORE

  const toleranceHoursAfter =
    space.type === 'workstation'
      ? WORKSTATION_CHECK_IN_TOLERANCE_HOURS_AFTER
      : ROOM_CHECK_IN_TOLERANCE_HOURS_AFTER

  const checkInStartWindow = addMinutes(startTime, -toleranceMinutesBefore)
  const checkInEndWindow = addHours(startTime, toleranceHoursAfter)

  if (
    currentDate.getTime() < checkInStartWindow.getTime() ||
    currentDate.getTime() > checkInEndWindow.getTime()
  ) {
    const toleranceMessage =
      space.type === 'workstation'
        ? `${toleranceMinutesBefore} minutos antes até ${toleranceHoursAfter} horas após o início da reserva`
        : `${toleranceMinutesBefore} minutos antes até ${toleranceHoursAfter} hora após o início da reserva`

    throw new BadRequestError({
      message: 'Check-in fora da janela de horário permitida',
      action: `O check-in pode ser feito ${toleranceMessage}`,
      details: {
        where: 'reservation.checkInOut.checkIn',
        reservationId: reservation.id,
        spaceType: space.type,
        userId: user.id,
        currentTime: currentDate.toISOString(),
        reservationStartTime: startTime.toISOString(),
        checkInStartWindow: checkInStartWindow.toISOString(),
        checkInEndWindow: checkInEndWindow.toISOString(),
        reason: 'outside_check_in_window',
      },
    })
  }

  // Registrar o check-in
  await deps.spaceCheckInOutRepository.create({
    spaceId: space.id,
    userId: user.id,
    reservationId: reservation.id,
    type: 'check-in',
  })

  return 'Check-in realizado com sucesso'
}

/**
 * Executa a lógica de check-out
 */
async function executeCheckOut(
  reservation: any,
  space: any,
  user: UserAccountContext,
  deps: Dependencies,
): Promise<string> {
  // Verificar se o usuário já fez check-in (obrigatório para check-out)
  const checkInRecord = reservation.checkInOuts.find(
    (record: SpaceCheckInOut) =>
      record.type === 'check-in' && record.userId === user.id,
  )

  if (!checkInRecord) {
    throw new BadRequestError({
      message: 'Você precisa fazer check-in antes de fazer check-out',
      action: 'Faça o check-in primeiro',
      details: {
        where: 'reservation.checkInOut.checkOut',
        reservationId: reservation.id,
        userId: user.id,
        reason: 'check_in_required',
      },
    })
  }

  // Verificar se o usuário já fez check-out
  const hasCheckOut = reservation.checkInOuts.some(
    (record: SpaceCheckInOut) =>
      record.type === 'check-out' && record.userId === user.id,
  )

  if (hasCheckOut) {
    throw new BadRequestError({
      message: 'Você já realizou check-out para esta reserva',
      action: 'Não é possível realizar múltiplos check-outs na mesma reserva',
      details: {
        where: 'reservation.checkInOut.checkOut',
        reservationId: reservation.id,
        userId: user.id,
        reason: 'already_checked_out',
      },
    })
  }

  // Validar se o check-out está sendo feito no mesmo dia do check-in
  const currentDate = new Date()
  const checkInTime = parseISO(checkInRecord.createdAt)

  if (!isSameDay(currentDate, checkInTime)) {
    throw new BadRequestError({
      message: 'O check-out deve ser feito no mesmo dia do check-in',
      action:
        'Não é possível realizar check-out em um dia diferente do check-in',
      details: {
        where: 'reservation.checkInOut.checkOut',
        reservationId: reservation.id,
        userId: user.id,
        checkInDate: checkInTime.toISOString(),
        currentDate: currentDate.toISOString(),
        reason: 'checkout_different_day',
      },
    })
  }

  // Calcular horas trabalhadas e verificar se é checkout antecipado (apenas para workstations)
  const workedMinutes = Math.floor(
    (currentDate.getTime() - checkInTime.getTime()) / (1000 * 60),
  )
  const workedHours = parseFloat((workedMinutes / 60).toFixed(2))

  // Determinar se é checkout antecipado (apenas para workstations)
  const isWorkstation = space.type === 'workstation'
  const isEarlyCheckout =
    isWorkstation && workedMinutes < WORKSTATION_MINIMUM_JOURNEY_MINUTES

  // Registrar o check-out com informações de checkout antecipado se aplicável
  await deps.spaceCheckInOutRepository.create({
    spaceId: space.id,
    userId: user.id,
    reservationId: reservation.id,
    type: 'check-out',
    // Campos de checkout antecipado (apenas para workstations)
    isEarlyCheckout: isWorkstation ? isEarlyCheckout : undefined,
    earlyCheckoutStatus: isEarlyCheckout ? 'pending' : undefined,
    workedHours: isWorkstation ? workedHours : undefined,
  })

  // Fechar a reserva após o check-out
  await deps.spaceReservationRepository.closeReservation(
    reservation.id,
    user.id,
  )

  // Deletar os slots de espaço associados à reserva fechada
  if (reservation.spaceSlotIds && reservation.spaceSlotIds.length > 0) {
    await deps.spaceSlotRepository.deleteByIds(reservation.spaceSlotIds)
  }

  return 'Check-out realizado com sucesso'
}

// ========================================
// 📌 USE CASE PRINCIPAL
// ========================================

export async function reservationCheckInOutUseCase(
  input: InputProps,
  deps: Dependencies,
): Promise<ReservationCheckInOutResponse> {
  const { spaceId } = input.params
  const { reservationId, type } = input.body
  const { user } = input

  // 1. Verificar se o espaço existe
  const space = await deps.spacesRepository.findById(spaceId)

  if (!space) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique se o ID do espaço está correto',
      details: {
        where: 'reservation.checkInOut',
        spaceId,
        userId: user.id,
      },
    })
  }

  // 2. Buscar a reserva específica
  const reservation =
    await deps.spaceReservationRepository.getReservationDetailById(
      reservationId,
    )

  if (!reservation) {
    throw new NotFoundError({
      message: 'Reserva não encontrada',
      action: 'Verifique se o ID da reserva está correto',
      details: {
        where: 'reservation.checkInOut',
        reservationId,
        spaceId,
        userId: user.id,
      },
    })
  }

  // 3. Validar se a reserva pertence ao espaço informado
  if (reservation.space.id !== spaceId) {
    throw new BadRequestError({
      message: 'A reserva não pertence a este espaço',
      action: 'Verifique se você está no espaço correto',
      details: {
        where: 'reservation.checkInOut',
        reservationId,
        reservationSpaceId: reservation.space.id,
        requestedSpaceId: spaceId,
        userId: user.id,
      },
    })
  }

  // 4. Validar status da reserva
  if (reservation.status !== 'reserved') {
    throw new BadRequestError({
      message: `Não é possível fazer check-in/out em uma reserva com status '${reservation.status}'`,
      action:
        'Apenas reservas com status "reserved" podem ter check-in/out realizados',
      details: {
        where: 'reservation.checkInOut',
        reservationId,
        reservationStatus: reservation.status,
        userId: user.id,
      },
    })
  }

  // 5. Validar permissões do usuário
  validateUserPermission(reservation, user)

  // 6. Executar a operação solicitada

  let message: string

  if (type === 'check-in') {
    message = await executeCheckIn(reservation, space, user, deps)
  } else {
    message = await executeCheckOut(reservation, space, user, deps)
  }

  // 7. Buscar os detalhes atualizados da reserva após a operação
  const reservationDetail =
    await deps.spaceReservationRepository.getReservationDetailById(
      reservationId,
    )

  if (!reservationDetail) {
    throw new BadRequestError({
      message: 'Não foi possível obter os detalhes atualizados da reserva',
      action: 'Tente novamente ou entre em contato com o suporte',
      details: {
        where: 'reservation.checkInOut',
        reservationId,
        userId: user.id,
        operationType: type,
        reason: 'reservation_detail_not_found_after_operation',
      },
    })
  }

  // 8. Retornar resposta formatada
  const response = {
    message,
    reservation: {
      id: reservationDetail.id,
      checkInAt:
        reservationDetail.checkInOuts.find(
          (r: SpaceCheckInOut) => r.type === 'check-in' && r.userId === user.id,
        )?.createdAt || null,
      checkOutAt:
        reservationDetail.checkInOuts.find(
          (r: SpaceCheckInOut) =>
            r.type === 'check-out' && r.userId === user.id,
        )?.createdAt || null,
      status: reservationDetail.status,
    },
  }

  return response
}

export const reservationCheckInOutUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
