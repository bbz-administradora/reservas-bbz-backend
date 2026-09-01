// src/models/space-slot/space-slot-availability-use-case.ts
import {
  BadRequestErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, NotFoundError } from '@/infra/errors'
import { SpaceWithSlots } from '@/repositories/base/space-slot-repository'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { getNextWeekLastDay } from '@/utils/date-utils'

// Constantes para configurações do sistema
const MAX_CONSULTATION_DAYS_FOR_ROOMS = 7 // Limite para salas de reunião
const DEFAULT_START_HOUR = '07:00'
const DEFAULT_END_HOUR = '21:00' // Alterado de 20:00 para 21:00 para incluir reservas no último horário
const SAO_PAULO_TIMEZONE = '-03:00'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const HOUR_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export interface GetSpaceSlotAvailabilityInput {
  params: {
    spaceId: string
  }
  query: {
    startDate: string // YYYY-MM-DD
    endDate: string // YYYY-MM-DD
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
  spaceSlotRepository: PgSpaceSlotRepository
}

export async function getSpaceSlotAvailability(
  { params, query }: GetSpaceSlotAvailabilityInput,
  deps: Dependencies,
): Promise<SpaceWithSlots> {
  const { spaceId } = params
  const { startDate: startDateStr, endDate: endDateStr } = query

  // Verificar se o espaço existe
  const space = await deps.spacesRepository.findById(spaceId)

  if (!space) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço e tente novamente',
      details: {
        where: 'spaceSlot.availability',
        spaceId,
      },
    })
  }

  // Verificar se o espaço está ativo
  if (!space.isActive) {
    throw new NotFoundError({
      message: 'Espaço inativo ou indisponível',
      action: 'Este espaço não está disponível para reservas',
      details: {
        where: 'spaceSlot.availability',
        spaceId,
        isActive: space.isActive,
        reason: 'space_inactive',
      },
    })
  }

  // Validar formato das datas
  if (!DATE_REGEX.test(startDateStr) || !DATE_REGEX.test(endDateStr)) {
    throw new BadRequestError({
      message: 'Formato de data inválido',
      action: 'Use o formato YYYY-MM-DD (ex: 2023-08-15)',
      details: {
        where: 'spaceSlot.availability',
        spaceId,
        startDate: startDateStr,
        endDate: endDateStr,
        reason: 'invalid_date_format',
      },
    })
  }

  // Criar objetos Date para comparações
  const startDate = new Date(`${startDateStr}T00:00:00${SAO_PAULO_TIMEZONE}`)
  const endDate = new Date(`${endDateStr}T23:59:59${SAO_PAULO_TIMEZONE}`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Verificar se a data inicial é posterior à data final
  if (startDate > endDate) {
    throw new BadRequestError({
      message: 'A data inicial não pode ser posterior à data final',
      action: 'Ajuste as datas e tente novamente',
      details: {
        where: 'spaceSlot.availability',
        spaceId,
        startDate: startDateStr,
        endDate: endDateStr,
        reason: 'start_date_after_end_date',
      },
    })
  }

  // Verificar se a data inicial é anterior a hoje
  if (startDate < today) {
    throw new BadRequestError({
      message: 'A data inicial não pode ser anterior à data atual',
      action: 'Selecione uma data a partir de hoje',
      details: {
        where: 'spaceSlot.availability',
        spaceId,
        startDate: startDateStr,
        today: today.toISOString(),
        reason: 'start_date_in_past',
      },
    })
  }

  // Verificar limite de período baseado no tipo de espaço
  const timeDiff = endDate.getTime() - startDate.getTime()
  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

  if (space.type === 'workstation') {
    // Para workstations: limite até o sábado da próxima semana
    const maxWorkstationDate = getNextWeekLastDay(today)

    // Formatar a data máxima no formato YYYY-MM-DD em horário de São Paulo
    const year = maxWorkstationDate.getFullYear()
    const month = String(maxWorkstationDate.getMonth() + 1).padStart(2, '0')
    const day = String(maxWorkstationDate.getDate()).padStart(2, '0')
    const maxDateOnly = `${year}-${month}-${day}`

    if (endDateStr > maxDateOnly) {
      throw new BadRequestError({
        message:
          'Para estações de trabalho, o período de consulta não pode ser além do sábado da próxima semana',
        action: `Selecione uma data final até ${maxWorkstationDate.toLocaleDateString('pt-BR')} (sábado da próxima semana)`,
        details: {
          where: 'spaceSlot.availability',
          spaceId,
          spaceType: space.type,
          startDate: startDateStr,
          endDate: endDateStr,
          maxDate: maxDateOnly,
          reason: 'workstation_period_exceeds_limit',
        },
      })
    }
  } else {
    // Para salas de reunião: limite de 7 dias
    if (dayDiff > MAX_CONSULTATION_DAYS_FOR_ROOMS) {
      throw new BadRequestError({
        message: `O período de consulta não pode ser maior que ${MAX_CONSULTATION_DAYS_FOR_ROOMS} dias`,
        action: `Reduza o intervalo entre as datas para no máximo ${MAX_CONSULTATION_DAYS_FOR_ROOMS} dias`,
        details: {
          where: 'spaceSlot.availability',
          spaceId,
          spaceType: space.type,
          startDate: startDateStr,
          endDate: endDateStr,
          dayDiff,
          maxDays: MAX_CONSULTATION_DAYS_FOR_ROOMS,
          reason: 'period_too_long',
        },
      })
    }
  }

  // Tratamento para horário de funcionamento
  const formattedStartDate = startDateStr
  const formattedEndDate = endDateStr

  // Obter slots existentes e disponibilidade do espaço entre as datas especificadas
  const spaceAvailability = await deps.spaceSlotRepository.getSpaceAvailability(
    spaceId,
    formattedStartDate,
    formattedEndDate,
    DEFAULT_START_HOUR,
    DEFAULT_END_HOUR,
    SAO_PAULO_TIMEZONE,
  )

  // Formatando resposta de acordo com o schema esperado
  return {
    space: spaceAvailability.space,
    slots: spaceAvailability.slots,
  }
}

export const getSpaceSlotAvailabilitySchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
}
