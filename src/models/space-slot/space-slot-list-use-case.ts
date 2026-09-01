// src/models/space-slot/space-slot-list-use-case.ts
import { BadRequestErrorSchema } from '@/@types/http-errors-schema'
import { BadRequestError } from '@/infra/errors'
import { PgSpaceSlotRepository } from '@/repositories/pg/pg-space-slot-repository'
import { format, getHours, getMinutes } from 'date-fns'

// Constantes para configuração de horários e duração
const EARLIEST_HOUR = 7 // 07:00 (primeira hora disponível)
const LATEST_HOUR = 21 // 20:00 (última hora disponível, 21 para permitir 20:00)
const DEFAULT_TIMEZONE = '-03:00' // Fuso horário padrão (Brasil)
const SLOT_DURATION_MINUTES = 60 // Duração de cada slot em minutos
const DEFAULT_START_HOUR = '07:00' // Horário de início padrão para consultas de dia inteiro
const DEFAULT_END_HOUR = '20:00' // Horário de término padrão para consultas de dia inteiro

export interface ListSpaceSlotsInput {
  query: {
    datetime: string
    page?: number
    pageSize?: number
    type?: 'room' | 'workstation'
  }
}

interface Dependencies {
  spaceSlotRepository: PgSpaceSlotRepository
}

export async function listAvailableSpaces(
  { query }: ListSpaceSlotsInput,
  deps: Dependencies,
) {
  // Parse a data e verifica se é válida
  const dateTime = new Date(query.datetime)

  if (isNaN(dateTime.getTime())) {
    throw new BadRequestError({
      message: 'Data/hora inválida',
      action:
        'Forneça uma data/hora válida no formato ISO com timezone (exemplo: 2025-05-22T00:00:00-03:00)',
      details: {
        where: 'spaceSlot.list',
        providedDatetime: query.datetime,
        reason: 'invalid_datetime',
      },
    })
  }

  // Utiliza date-fns para manipulação de datas de forma mais confiável
  // Extrai a data no formato YYYY-MM-DD
  const date = format(dateTime, 'yyyy-MM-dd')

  // Extrai fuso horário do string original
  const timeZoneMatch = query.datetime.match(/([+-][0-9]{2}:[0-9]{2})$/)
  const timeZoneOffset = timeZoneMatch ? timeZoneMatch[1] : DEFAULT_TIMEZONE

  // Extrai a hora e minutos do string original para evitar problemas de timezone
  // Formato esperado: yyyy-MM-ddTHH:mm:ss.SSS+/-ZZ:ZZ

  // Usa regex para extrair horas e minutos diretamente da string
  // A regex completa que captura horas e minutos com validação mais robusta
  const timeMatch = query.datetime.match(/T(\d{2}):(\d{2}):/)

  // Extração segura com fallback e validação de valores
  let hoursNum: number
  let minutesNum: number

  if (timeMatch && timeMatch.length >= 3) {
    // Extrai da string com validação de valor
    hoursNum = Math.max(0, Math.min(23, parseInt(timeMatch[1]) || 0))
    minutesNum = Math.max(0, Math.min(59, parseInt(timeMatch[2]) || 0))
  } else {
    // Fallback para a extração via objeto Date (menos confiável com timezones)
    hoursNum = getHours(dateTime)
    minutesNum = getMinutes(dateTime)
  }

  // Verifica se é uma consulta apenas de data (00:00:00) ou se inclui hora específica
  const isDateOnlyQuery = hoursNum === 0 && minutesNum === 0 // Se não for consulta só de data, valida se a hora está no intervalo permitido
  if (!isDateOnlyQuery) {
    if (hoursNum < EARLIEST_HOUR || hoursNum >= LATEST_HOUR) {
      throw new BadRequestError({
        message: `Horário inválido: ${hoursNum}:00`,
        action: `O horário deve estar entre ${EARLIEST_HOUR}:00 e ${LATEST_HOUR - 1}:00`,
        details: {
          where: 'spaceSlot.list',
          providedHour: hoursNum,
          earliestHour: EARLIEST_HOUR,
          latestHour: LATEST_HOUR - 1,
          reason: 'invalid_hour_range',
        },
      })
    }

    // Formata a hora sempre como HH:00 (normalizando os minutos para zero)
    // Exemplo: 14:35 será normalizado para 14:00
  }

  // Formata a hora no formato HH:mm para o repositório
  const formattedHour = isDateOnlyQuery
    ? '00:00'
    : `${hoursNum.toString().padStart(2, '0')}:00`

  // Validar os parâmetros de paginação
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 12
  const type = query.type ?? 'room'

  if (page < 1) {
    throw new BadRequestError({
      message: 'Número de página inválido',
      action: 'A página deve ser um número positivo, começando em 1',
      details: {
        where: 'spaceSlot.list',
        providedPage: page,
        reason: 'invalid_page_number',
      },
    })
  }

  if (pageSize < 1 || pageSize > 100) {
    throw new BadRequestError({
      message: 'Tamanho de página inválido',
      action: 'O tamanho da página deve ser entre 1 e 100 itens por página',
      details: {
        where: 'spaceSlot.list',
        providedPageSize: pageSize,
        reason: 'invalid_page_size',
      },
    })
  }

  let result

  if (isDateOnlyQuery) {
    // Consulta por data (espaços com pelo menos um horário disponível)
    result = await deps.spaceSlotRepository.listAvailableSpacesByDate(
      date,
      page,
      pageSize,
      DEFAULT_START_HOUR,
      DEFAULT_END_HOUR,
      timeZoneOffset,
      type,
    )
  } else {
    // Consulta por data e hora específica
    result = await deps.spaceSlotRepository.listAvailableSpacesByDateAndHour(
      date,
      formattedHour,
      page,
      pageSize,
      SLOT_DURATION_MINUTES,
      timeZoneOffset,
      type,
    )
  }

  // Preparar mensagem informativa baseada nos resultados da paginação
  let message = 'Espaços disponíveis listados com sucesso'
  if (result.totalCount === 0) {
    message = isDateOnlyQuery
      ? `Nenhum espaço disponível para o dia ${date}`
      : `Nenhum espaço disponível para o horário ${date} às ${formattedHour}`
  } else if (result.totalPages > 1) {
    message = `Mostrando página ${result.currentPage} de ${result.totalPages} (${result.totalCount} espaços disponíveis)`
  } else {
    message = `${result.totalCount} espaços disponíveis encontrados`
  }

  return {
    spaces: result.spaces,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    message,
  }
}

export const listSpaceSlotsSchema = {
  400: BadRequestErrorSchema,
}
