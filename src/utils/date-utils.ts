// src/utils/date-utils.ts
import { addWeeks, endOfWeek, startOfWeek } from 'date-fns'

/**
 * Obtém o último dia (sábado) da próxima semana
 *
 * Esta função é usada para calcular o limite máximo de reserva de workstations.
 * Workstations só podem ser reservadas até o sábado da próxima semana.
 * Considera que a semana começa no domingo e termina no sábado.
 *
 * Exemplos:
 * - Se hoje é segunda-feira (20/01/2026), retorna sábado (31/01/2026)
 * - Se hoje é quinta-feira (23/01/2026), retorna sábado (31/01/2026)
 * - Se hoje é sábado (25/01/2026), retorna sábado (31/01/2026)
 * - Se hoje é domingo (26/01/2026), retorna sábado (07/02/2026)
 *
 * @param referenceDate - Data de referência (padrão: agora)
 * @returns Data do último dia (sábado) da próxima semana, às 23:59:59.999
 */
export function getNextWeekLastDay(referenceDate: Date = new Date()): Date {
  // Obtém o sábado da semana atual (considerando domingo como início da semana)
  const currentWeekEnd = endOfWeek(referenceDate, { weekStartsOn: 0 })

  // Como endOfWeek com weekStartsOn: 0 retorna o sábado, precisamos obter o sábado da próxima semana
  const nextWeekEnd = addWeeks(currentWeekEnd, 1)

  return nextWeekEnd
}

/**
 * Obtém o início (domingo) e fim (sábado) da próxima semana
 *
 * Esta função é usada para verificar o período de compliance semanal.
 * Retorna a semana completa de domingo a sábado.
 *
 * @param referenceDate - Data de referência (padrão: agora)
 * @returns Objeto com startDate (domingo às 00:00) e endDate (sábado às 23:59:59.999)
 */
export function getNextWeekRange(referenceDate: Date = new Date()): {
  startDate: Date
  endDate: Date
} {
  // Obtém o domingo da semana atual
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 0 })

  // Adiciona 1 semana para obter o domingo da próxima semana
  const nextWeekStart = addWeeks(currentWeekStart, 1)

  // Obtém o sábado da próxima semana
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 6) // domingo + 6 dias = sábado
  nextWeekEnd.setHours(23, 59, 59, 999)

  return {
    startDate: nextWeekStart,
    endDate: nextWeekEnd,
  }
}

/**
 * Obtém o início (domingo) e fim (sábado) da semana atual (vigente)
 *
 * Esta função é usada para verificar o período de compliance da semana atual.
 * Retorna a semana completa de domingo a sábado.
 *
 * @param referenceDate - Data de referência (padrão: agora)
 * @returns Objeto com startDate (domingo às 00:00) e endDate (sábado às 23:59:59.999)
 */
export function getCurrentWeekRange(referenceDate: Date = new Date()): {
  startDate: Date
  endDate: Date
} {
  // Obtém o domingo da semana atual
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 0 })

  // Obtém o sábado da semana atual
  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6) // domingo + 6 dias = sábado
  currentWeekEnd.setHours(23, 59, 59, 999)

  return {
    startDate: currentWeekStart,
    endDate: currentWeekEnd,
  }
}

/**
 * Retorna a quantidade de dias obrigatórios de reserva por cargo
 *
 * @param position - Cargo do colaborador
 * @returns Número de dias obrigatórios (0 para supervisor/diretor)
 */
export function getRequiredDaysByPosition(
  position:
    | 'manager'
    | 'assistant_manager'
    | 'submanager'
    | 'assistant'
    | 'supervisor'
    | 'director'
    | string,
): number {
  const requirementsByPosition: Record<string, number> = {
    manager: 2,
    assistant_manager: 3,
    submanager: 3,
    assistant: 3,
  }

  return requirementsByPosition[position] || 0
}

/**
 * Verifica se a data atual é antes ou na quinta-feira da semana
 *
 * Usado para validar se o usuário ainda está no prazo de fazer reservas
 * para a próxima semana (prazo: até quinta-feira).
 *
 * @param referenceDate - Data de referência (padrão: agora)
 * @returns true se for segunda, terça, quarta ou quinta-feira
 */
export function isBeforeOrOnThursday(
  referenceDate: Date = new Date(),
): boolean {
  const dayOfWeek = referenceDate.getDay() // 0 = domingo, 1 = segunda, ..., 6 = sábado
  return dayOfWeek >= 1 && dayOfWeek <= 4 // segunda (1) até quinta (4)
}

/**
 * Obtém a quinta-feira da semana anterior a uma determinada semana
 *
 * Esta função calcula o prazo de planejamento para uma semana específica.
 * O prazo de planejamento de uma semana W é até quinta-feira da semana W-1.
 *
 * A semana vai de DOMINGO a SÁBADO (regra de negócio).
 *
 * @param weekStart - Domingo da semana para a qual queremos o prazo
 * @returns Quinta-feira da semana anterior às 23:59:59.999
 */
export function getPlanningDeadline(weekStart: Date): Date {
  // weekStart é o domingo da semana da reserva
  // Precisamos da quinta-feira da semana anterior
  // Domingo - 3 dias = Quinta da semana anterior
  const thursday = new Date(weekStart)
  thursday.setDate(thursday.getDate() - 3)
  thursday.setHours(23, 59, 59, 999)
  return thursday
}

/**
 * Obtém a semana (domingo a sábado) de uma determinada data
 *
 * A semana vai de DOMINGO a SÁBADO (regra de negócio).
 *
 * @param date - Data para a qual queremos saber a semana
 * @returns Objeto com startDate (domingo às 00:00) e endDate (sábado às 23:59:59.999)
 */
export function getWeekRangeForDate(date: Date): {
  startDate: Date
  endDate: Date
} {
  // Obtém o domingo da semana da data fornecida (weekStartsOn: 0 = domingo)
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })

  // Obtém o sábado da semana
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6) // domingo + 6 dias = sábado
  weekEnd.setHours(23, 59, 59, 999)

  return {
    startDate: weekStart,
    endDate: weekEnd,
  }
}

/**
 * Verifica se o prazo de planejamento de uma reserva já expirou
 *
 * O prazo de planejamento de uma semana W é até quinta-feira da semana anterior (W-1).
 * Após esse prazo, cancelamentos de reservas da semana W devem notificar o supervisor.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * REGRAS DE NEGÓCIO:
 * ═══════════════════════════════════════════════════════════════════════════════
 * - A semana vai de DOMINGO a SÁBADO
 * - Reservas são feitas de SEGUNDA a QUINTA-FEIRA para a próxima semana
 * - NÃO é permitido fazer reservas às SEXTAS-FEIRAS
 * - O prazo para cancelar uma reserva da semana W é até quinta-feira da semana W-1
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXEMPLOS PRÁTICOS:
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * CENÁRIO 1: Reserva 02/02/2026 (segunda), cancelada em 25/01/2026 (DENTRO do prazo)
 * ───────────────────────────────────────────────────────────────────────────────
 * - Reserva: 02/02/2026 (semana 01/02 a 07/02, domingo a sábado)
 * - Prazo: Quinta 29/01/2026 (semana anterior à reserva)
 * - Cancelou: 25/01/2026
 * - 25/01 < 29/01 → NÃO NOTIFICA ✅
 *
 * CENÁRIO 2: Reserva 01/02/2026 (domingo), cancelada em 26/01/2026 (DENTRO do prazo)
 * ───────────────────────────────────────────────────────────────────────────────
 * - Reserva: 01/02/2026 (semana 01/02 a 07/02, domingo a sábado)
 * - Prazo: Quinta 29/01/2026 (semana anterior à reserva)
 * - Cancelou: 26/01/2026
 * - 26/01 < 29/01 → NÃO NOTIFICA ✅
 *
 * CENÁRIO 3: Reserva 28/01/2026 (quarta), cancelada em 25/01/2026 (FORA do prazo)
 * ───────────────────────────────────────────────────────────────────────────────
 * - Reserva: 28/01/2026 (semana 25/01 a 31/01, domingo a sábado)
 * - Prazo: Quinta 22/01/2026 (semana anterior à reserva)
 * - Cancelou: 25/01/2026
 * - 25/01 > 22/01 → NOTIFICA SUPERVISOR ✅
 *
 * CENÁRIO 4: Reserva 28/01/2026 (quarta), cancelada em 23/01/2026 (FORA do prazo)
 * ───────────────────────────────────────────────────────────────────────────────
 * - Reserva: 28/01/2026 (semana 25/01 a 31/01, domingo a sábado)
 * - Prazo: Quinta 22/01/2026 (semana anterior à reserva)
 * - Cancelou: 23/01/2026 (sexta)
 * - 23/01 > 22/01 → NOTIFICA SUPERVISOR ✅
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @param reservationDate - Data da reserva que está sendo encerrada
 * @param referenceDate - Data/hora atual (quando o encerramento está sendo feito)
 * @returns true se o prazo expirou e deve notificar o supervisor
 */
export function isPlanningDeadlineExpired(
  reservationDate: Date,
  referenceDate: Date = new Date(),
): boolean {
  // 1. Descobre qual semana a reserva pertence
  const { startDate: weekStart } = getWeekRangeForDate(reservationDate)

  // 2. Calcula a quinta-feira da semana anterior (prazo de planejamento)
  const deadline = getPlanningDeadline(weekStart)

  // 3. Verifica se a data de referência (hoje) é após o prazo
  return referenceDate > deadline
}
