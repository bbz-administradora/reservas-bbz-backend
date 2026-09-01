// src/models/space-slot/space-slot-pre-reserve-use-case.ts
import {
  BadRequestErrorSchema,
  ConflictErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ConflictError, NotFoundError } from '@/infra/errors'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { SpaceSlotPreReserveResponse } from '@/schemas/space-slot/space-slot-pre-reserve-schema'
import {
  getCurrentWeekRange,
  getNextWeekLastDay,
  getNextWeekRange,
} from '@/utils/date-utils'
import { addMinutes, endOfWeek, getDay, startOfWeek } from 'date-fns'

export interface CreateSpaceSlotPreReserveInput {
  body: {
    spaceId: string
    userId: string
    slotStart: string // ISO string com timezone do usuário
    slotEnd: string // ISO string com timezone do usuário
    status?: 'pre_reserved' | 'reserved' // opcional com default 'pre_reserved'
    /** Data/hora limite da exceção de prazo do usuário (ISO string ou null) */
    bookingExceptionUntil?: string | null
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
  spaceSlotRepository: PgSpaceSlotRepository
}

// ========================================
// 📌 CONSTANTES DE REGRAS DE NEGÓCIO
// ========================================

const MAX_DELAYED_MINUTES = 30 // Tempo máximo permitido para reservar após o início do slot
const MAX_FUTURE_DAYS = 90 // Limite para salas de reunião

// Regras de agendamento para workstations
// Lista de dias da semana em que NÃO é permitido fazer reservas (0 = domingo, 1 = segunda, ..., 6 = sábado)
const BLOCKED_RESERVATION_WEEKDAYS = [5] // [5] = sexta-feira bloqueada

// ========================================
// 📌 HELPERS
// ========================================

/**
 * Verifica se o usuário tem uma exceção de prazo ativa.
 * @param bookingExceptionUntil Data/hora limite da exceção (ISO string ou null)
 * @returns true se a exceção está ativa (data futura)
 */
function hasActiveBookingException(
  bookingExceptionUntil: string | null | undefined,
): boolean {
  if (!bookingExceptionUntil) return false
  return new Date(bookingExceptionUntil) > new Date()
}

/**
 * Verifica se o slot está na semana vigente (atual).
 */
function isSlotInCurrentWeek(slotStartDate: Date, now: Date): boolean {
  const { startDate: currentWeekStart, endDate: currentWeekEnd } =
    getCurrentWeekRange(now)
  return slotStartDate >= currentWeekStart && slotStartDate <= currentWeekEnd
}

/**
 * Verifica se o slot está na próxima semana.
 */
function isSlotInNextWeek(slotStartDate: Date, now: Date): boolean {
  const { startDate: nextWeekStart, endDate: nextWeekEnd } =
    getNextWeekRange(now)
  return slotStartDate >= nextWeekStart && slotStartDate <= nextWeekEnd
}

export async function createSpaceSlotPreReserve(
  { body }: CreateSpaceSlotPreReserveInput,
  deps: Dependencies,
): Promise<SpaceSlotPreReserveResponse> {
  // Verificar se o espaço existe
  const space = await deps.spacesRepository.findById(body.spaceId)

  if (!space) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço e tente novamente',
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        userId: body.userId,
      },
    })
  }

  // Verificar se o espaço está ativo
  if (!space.isActive) {
    throw new BadRequestError({
      message: 'Espaço inativo ou indisponível',
      action: 'Este espaço não está disponível para reservas',
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        isActive: space.isActive,
        reason: 'space_inactive',
      },
    })
  }

  // Validar se os horários foram fornecidos
  if (!body.slotStart || !body.slotEnd) {
    throw new BadRequestError({
      message: 'Horário de início e término são obrigatórios',
      action: 'Forneça os horários no formato ISO com timezone',
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        slotStart: body.slotStart,
        slotEnd: body.slotEnd,
        reason: 'missing_slot_times',
      },
    })
  }

  // Converter as strings ISO para objetos Date
  const slotStartDate = new Date(body.slotStart)
  const slotEndDate = new Date(body.slotEnd)
  const now = new Date()

  // Calcular o tempo máximo que pode ter passado do horário de início (30 minutos) somente para room
  const maxDelayedTime = new Date(slotStartDate)
  maxDelayedTime.setMinutes(maxDelayedTime.getMinutes() + MAX_DELAYED_MINUTES)

  // Definir tempo máximo futuro para reservas (3 meses)
  const maxFutureDate = new Date()
  maxFutureDate.setDate(now.getDate() + MAX_FUTURE_DAYS)

  // Verificar se o horário já passou do limite de 30 minutos
  if (now > maxDelayedTime && space.type === 'room') {
    const horaInicio = slotStartDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const horaAtual = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const horaLimite = maxDelayedTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    throw new BadRequestError({
      message: `Não é possível reservar horários que já passaram mais de ${MAX_DELAYED_MINUTES} minutos`,
      action: `São ${horaAtual} agora. O horário de início era ${horaInicio} e o limite para reserva era ${horaLimite}. Por favor, escolha um horário disponível.`,
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        slotStart: body.slotStart,
        currentTime: now.toISOString(),
        maxDelayedTime: maxDelayedTime.toISOString(),
        reason: 'slot_time_exceeded',
      },
    })
  }

  // Verificar se a data não está muito no futuro
  if (slotStartDate > maxFutureDate) {
    throw new BadRequestError({
      message: `Não é possível fazer reservas para mais de ${MAX_FUTURE_DAYS} dias no futuro`,
      action: `Por favor, selecione uma data até ${maxFutureDate.toLocaleDateString('pt-BR')}`,
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        slotStart: body.slotStart,
        maxFutureDate: maxFutureDate.toISOString(),
        maxDays: MAX_FUTURE_DAYS,
        reason: 'date_too_far_in_future',
      },
    })
  }

  // Verificações específicas para workstations
  if (space.type === 'workstation') {
    // Verificar se o usuário tem exceção de prazo ativa
    const hasException = hasActiveBookingException(body.bookingExceptionUntil)
    const slotInCurrentWeek = isSlotInCurrentWeek(slotStartDate, now)
    const slotInNextWeek = isSlotInNextWeek(slotStartDate, now)

    // Validação 0: Não é permitido fazer reservas para a semana atual
    // EXCEÇÃO: Se o usuário tem exceção ativa E o slot é da semana vigente, PULA esta validação
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 })
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 })

    // Verificar se a data do slot está dentro da semana atual
    if (slotStartDate >= currentWeekStart && slotStartDate <= currentWeekEnd) {
      // Se tem exceção ativa, permite reservar na semana atual
      if (!hasException) {
        throw new BadRequestError({
          message:
            'Não é possível reservar estações de trabalho na semana atual',
          action:
            'Você só pode agendar para a próxima semana em diante. As reservas devem ser feitas até quinta-feira da semana anterior.',
          details: {
            where: 'spaceSlot.preReserve',
            spaceId: body.spaceId,
            spaceType: space.type,
            slotStart: body.slotStart,
            currentDate: now.toISOString(),
            currentWeekStart: currentWeekStart.toISOString(),
            currentWeekEnd: currentWeekEnd.toISOString(),
            reason: 'cannot_reserve_current_week',
          },
        })
      }
    }

    // Validação 1: Verificar se hoje é um dia bloqueado para fazer reservas (sexta-feira)
    // EXCEÇÃO: Se o usuário tem exceção ativa, PULA esta validação
    const todayWeekday = getDay(now)

    if (BLOCKED_RESERVATION_WEEKDAYS.includes(todayWeekday) && !hasException) {
      const weekdayNames = [
        'domingo',
        'segunda-feira',
        'terça-feira',
        'quarta-feira',
        'quinta-feira',
        'sexta-feira',
        'sábado',
      ]
      const blockedDaysNames = BLOCKED_RESERVATION_WEEKDAYS.map(
        (day) => weekdayNames[day],
      ).join(', ')

      throw new BadRequestError({
        message: `Não é permitido realizar reservas de estações de trabalho às ${blockedDaysNames}`,
        action:
          'Programe sua agenda da semana seguinte até quinta-feira. As reservas devem ser feitas de segunda a quinta-feira.',
        details: {
          where: 'spaceSlot.preReserve',
          spaceId: body.spaceId,
          spaceType: space.type,
          currentWeekday: todayWeekday,
          currentDate: now.toISOString(),
          blockedWeekdays: BLOCKED_RESERVATION_WEEKDAYS,
          reason: 'weekday_reservations_blocked',
        },
      })
    }

    // Validação 2: Limite até o último dia (sábado) da próxima semana
    // Workstations só podem ser reservadas até o sábado da próxima semana
    // Semana: domingo a sábado
    // Exemplo: Se hoje é segunda (20/01), pode reservar até sábado (31/01)
    const maxWorkstationDate = getNextWeekLastDay(now)

    if (slotStartDate > maxWorkstationDate) {
      throw new BadRequestError({
        message:
          'Não é possível reservar estações de trabalho além do sábado da próxima semana',
        action: `Por favor, selecione uma data até ${maxWorkstationDate.toLocaleDateString('pt-BR')}. Você pode reservar no máximo até o final da próxima semana.`,
        details: {
          where: 'spaceSlot.preReserve',
          spaceId: body.spaceId,
          spaceType: space.type,
          slotStart: body.slotStart,
          maxWorkstationDate: maxWorkstationDate.toISOString(),
          currentDate: now.toISOString(),
          reason: 'workstation_date_too_far',
        },
      })
    }
  }

  // Verificar se a hora de início é anterior à hora de fim
  if (slotStartDate >= slotEndDate) {
    throw new BadRequestError({
      message: 'O horário de início deve ser anterior ao horário de término',
      action: 'Corrija os horários de início e término',
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        slotStart: body.slotStart,
        slotEnd: body.slotEnd,
        reason: 'start_not_before_end',
      },
    })
  }

  // Verificar se o horário de início é uma hora cheia (ex: 08:00, 09:00)
  if (
    slotStartDate.getMinutes() !== 0 ||
    slotStartDate.getSeconds() !== 0 ||
    slotStartDate.getMilliseconds() !== 0
  ) {
    throw new BadRequestError({
      message: 'O horário de início deve ser em hora cheia (ex: 08:00, 09:00)',
      action: 'Ajuste o horário de início para uma hora cheia',
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        slotStart: body.slotStart,
        minutes: slotStartDate.getMinutes(),
        seconds: slotStartDate.getSeconds(),
        reason: 'start_not_full_hour',
      },
    })
  }

  // Verificar se o horário de término é a próxima hora cheia
  const expectedEndTime = new Date(slotStartDate)
  expectedEndTime.setHours(
    expectedEndTime.getHours() + (space.type === 'workstation' ? 5 : 1),
  )

  if (
    slotEndDate.getHours() !== expectedEndTime.getHours() ||
    slotEndDate.getMinutes() !== 0 ||
    slotEndDate.getSeconds() !== 0 ||
    slotEndDate.getMilliseconds() !== 0
  ) {
    const duracaoHoras = space.type === 'workstation' ? '5 horas' : '1 hora'
    throw new BadRequestError({
      message: `O horário de término deve ser exatamente ${duracaoHoras} após o início`,
      action: `Para um início às ${slotStartDate.getHours()}:00, o término deve ser às ${expectedEndTime.getHours()}:00`,
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        spaceType: space.type,
        slotStart: body.slotStart,
        slotEnd: body.slotEnd,
        expectedEndHour: expectedEndTime.getHours(),
        actualEndHour: slotEndDate.getHours(),
        reason: 'invalid_end_time',
      },
    })
  }

  // Verificar se já existe um slot para esse espaço no horário solicitado
  const existingSlot = await deps.spaceSlotRepository.findBySpaceAndStart(
    body.spaceId,
    body.slotStart,
  )

  if (existingSlot) {
    throw new ConflictError({
      message: 'Horário já reservado ou pré-reservado',
      action: 'Selecione outro horário para este espaço',
      details: {
        where: 'spaceSlot.preReserve',
        spaceId: body.spaceId,
        slotStart: body.slotStart,
        existingSlotId: existingSlot.id,
        existingSlotStatus: existingSlot.status,
        reason: 'slot_already_taken',
      },
    })
  }

  /**
   * IMPORTANTE: Tratamento dos intervalos de horário
   *
   * Os slots de reserva têm as seguintes características:
   * 1. Cada slot começa em uma hora exata (ex: 08:00:00) e termina na hora seguinte (ex: 09:00:00)
   * 2. O horário de início é inclusivo, e o horário de término é exclusivo
   * 3. Isso significa que um slot das 08:00 às 09:00 inclui:
   *    - 08:00:00.000
   *    - 08:59:59.999
   *    - Mas NÃO inclui 09:00:00.000 (que pertence ao próximo slot)
   * 4. No banco de dados, isso é armazenado como tstzrange(startTime, endTime, '[)'),
   *    onde '[)' indica "início inclusivo, fim exclusivo"
   * 5. É possível reservar um slot mesmo após seu horário de início, desde que:
   *    - Não tenha passado mais de 30 minutos desde o início do slot
   *    - O slot ainda esteja disponível (não reservado por outro usuário)
   *
   * Essa abordagem garante que não haja sobreposição entre slots consecutivos,
   * permitindo que um slot termine exatamente no mesmo instante em que o próximo começa,
   * sem gerar conflitos de agendamento.
   */

  // Calcular o tempo de expiração da pré-reserva (5 minutos a partir de agora)
  const preReservedUntil = addMinutes(now, 5).toISOString()

  // Garantir que o status seja 'pre_reserved'
  const status = 'pre_reserved'

  // Normalizar horários de início e término para garantir formato exato HH:00:00.000
  // Isso garante que os horários estejam consistentes com nossa regra de negócio
  const normalizedStartDate = new Date(slotStartDate)
  normalizedStartDate.setMinutes(0, 0, 0) // Forçar minutos, segundos e milissegundos para zero

  const normalizedEndDate = new Date(slotEndDate)
  normalizedEndDate.setMinutes(0, 0, 0) // Forçar minutos, segundos e milissegundos para zero

  // Nota: No PostgreSQL, quando usamos tstzrange com '[)', ele automaticamente:
  // - Inclui o horário de início (ex: 08:00:00.000)
  // - Exclui o horário de fim (ex: 09:00:00.000)
  // Isso resulta efetivamente em um intervalo de 08:00:00.000 até 08:59:59.999...

  // Criar a pré-reserva usando o repositório com os horários normalizados
  const newSlot = await deps.spaceSlotRepository.createPreReservation({
    spaceId: body.spaceId,
    userId: body.userId,
    slotStart: normalizedStartDate.toISOString(),
    slotEnd: normalizedEndDate.toISOString(),
    status,
    preReservedUntil,
  })

  return {
    slot: {
      id: newSlot.id,
      spaceId: newSlot.spaceId,
      slotStart: newSlot.slotStart,
      slotEnd: newSlot.slotEnd,
      status: newSlot.status,
      userId: newSlot.userId,
      preReservedUntil: newSlot.preReservedUntil,
    },
    message:
      'Slot pré-reservado com sucesso! Você tem 5 minutos para confirmar a reserva.',
  }
}

export const createSpaceSlotPreReserveSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
  409: ConflictErrorSchema,
}
