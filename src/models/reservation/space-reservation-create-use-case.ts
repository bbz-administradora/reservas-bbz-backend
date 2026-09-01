// src/models/reservation/space-reservation-create-use-case.ts
import {
  BadRequestErrorSchema,
  ConflictErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ConflictError, NotFoundError } from '@/infra/errors'
import { generateICSSpaceReservation } from '@/lib/react-mail/ICS/space-reservation-confirmation'
import { IOutpostsRepository } from '@/repositories/base/outposts-repository'
import { ISpaceReservationRepository } from '@/repositories/base/space-reservation-repository'
import {
  ISpaceSlotRepository,
  SpaceSlot,
} from '@/repositories/base/space-slot-repository'
import { ISpaceRepository } from '@/repositories/base/spaces-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { IUserRepository } from '@/repositories/base/users-repository'
import {
  SpaceReservationCreateBodyInput,
  SpaceReservationCreateResponse,
} from '@/schemas/reservation/space-reservation-create-schema'
import { getCurrentWeekRange } from '@/utils/date-utils'
import { sendEmail } from '@/utils/email'
import { endOfWeek, startOfWeek } from 'date-fns'
import { format as formatTz, toZonedTime } from 'date-fns-tz'

/**
 * CONSTANTES DE LIMITES DE RESERVAS SEMANAIS POR CARGO
 *
 * Define o número máximo de dias que cada cargo pode reservar workstations por semana.
 * Esta regra se aplica SOMENTE a workstations, nunca a salas (rooms).
 */
const WEEKLY_WORKSTATION_LIMITS: Record<string, number> = {
  manager: 2, // Gerente: máximo 2 dias por semana
  assistant_manager: 3, // Subgerente: máximo 3 dias por semana
  assistant: 3, // Assistente: máximo 3 dias por semana
}

/**
 * Cargos que possuem limite de reservas semanais para workstations
 */
const POSITIONS_WITH_LIMITS = ['manager', 'assistant_manager', 'assistant']

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
 * Verifica se uma data está na semana vigente (atual).
 */
function isDateInCurrentWeek(date: Date, now: Date = new Date()): boolean {
  const { startDate: currentWeekStart, endDate: currentWeekEnd } =
    getCurrentWeekRange(now)
  return date >= currentWeekStart && date <= currentWeekEnd
}

export interface CreateSpaceReservationInput {
  body: SpaceReservationCreateBodyInput & {
    userId: string
    /** Data/hora limite da exceção de prazo do usuário (ISO string ou null) */
    bookingExceptionUntil?: string | null
  }
}

interface Dependencies {
  spacesRepository: ISpaceRepository
  spaceSlotRepository: ISpaceSlotRepository
  spaceReservationRepository: ISpaceReservationRepository
  usersRepository: IUserRepository
  teamPositionsRepository: ITeamPositionsRepository
  outpostsRepository: IOutpostsRepository
}

/**
 * Estrutura que representa um grupo de slots sequenciais
 * que serão combinados em uma única reserva
 */
interface SlotGroup {
  /** IDs dos slots agrupados na sequência */
  slotIds: string[]
  /** Horário de início do primeiro slot do grupo */
  startTime: string
  /** Horário de término do último slot do grupo */
  endTime: string
  /** Objetos de slot completos para processamento */
  slots: SpaceSlot[]
}

export async function createSpaceReservation(
  { body }: CreateSpaceReservationInput,
  deps: Dependencies,
): Promise<SpaceReservationCreateResponse> {
  const {
    spaceId,
    spaceSlotIds,
    userId,
    bbzCollaborators = [],
    externalGuests = [],
    needsCopeira = false,
  } = body

  if (
    !spaceId ||
    !spaceSlotIds ||
    !userId ||
    !Array.isArray(spaceSlotIds) ||
    spaceSlotIds.length === 0
  ) {
    throw new BadRequestError({
      message: 'Dados incompletos para criar reserva',
      action: 'Forneça spaceId, pelo menos um spaceSlotId e userId válidos',
      details: {
        where: 'reservation.create',
        spaceId,
        userId,
        spaceSlotIdsCount: spaceSlotIds?.length ?? 0,
        isArray: Array.isArray(spaceSlotIds),
      },
    })
  }

  // Carregar dados da sala e do usuário uma vez
  const [space, user] = await Promise.all([
    deps.spacesRepository.findById(spaceId),
    deps.usersRepository?.findById(userId),
  ])

  if (!space) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço e tente novamente',
      details: {
        where: 'reservation.create',
        spaceId,
        userId,
      },
    })
  }

  if (!space.isActive) {
    throw new BadRequestError({
      message: 'Espaço inativo ou indisponível',
      action: 'Este espaço não está disponível para reservas',
      details: {
        where: 'reservation.create',
        spaceId,
        spaceName: space.name,
        isActive: space.isActive,
        userId,
      },
    })
  }

  if (!user) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action: 'Verifique o ID do usuário e tente novamente',
      details: {
        where: 'reservation.create',
        userId,
        spaceId,
      },
    })
  }

  /**
   * VALIDAÇÃO DE AFASTAMENTO PARA WORKSTATIONS
   *
   * Usuários afastados (férias, licença, etc.) não podem fazer reservas de workstation.
   * A validação se aplica APENAS para workstations, salas continuam permitidas.
   */
  if (space.type === 'workstation') {
    if (user.absenceStartDate && user.absenceEndDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const absenceStart = new Date(user.absenceStartDate)
      const absenceEnd = new Date(user.absenceEndDate)

      if (today >= absenceStart && today <= absenceEnd) {
        const formattedEnd = formatTz(absenceEnd, 'dd/MM/yyyy', {
          timeZone: 'America/Sao_Paulo',
        })
        throw new BadRequestError({
          message:
            'Você está afastado e não pode fazer reservas de workstation neste período.',
          action: `Seu afastamento vai até ${formattedEnd}. Procure seu supervisor para mais informações.`,
          details: {
            where: 'reservation.create',
            userId,
            spaceId,
            spaceType: space.type,
            absenceStartDate: user.absenceStartDate,
            absenceEndDate: user.absenceEndDate,
          },
        })
      }
    }
  }

  /**
   * VALIDAÇÕES ESPECÍFICAS PARA WORKSTATIONS
   *
   * Para workstations, aplicamos duas validações importantes:
   * 1. Limite semanal por cargo (Gerente: 2 dias, Subgerente/Assistente: 3 dias)
   * 2. Apenas uma reserva por dia (não pode ter múltiplas reservas workstation no mesmo dia)
   *
   * EXCEÇÃO DE PRAZO: Quando o usuário possui uma exceção ativa (bookingExceptionUntil),
   * as validações de limite semanal e segunda/sexta são ignoradas APENAS para slots
   * na semana atual. A validação de "uma reserva por dia" continua ativa sempre.
   */
  if (space.type === 'workstation') {
    // Buscar todos os slots UMA ÚNICA VEZ para otimização
    const slotsForValidation =
      await deps.spaceSlotRepository.findByIds(spaceSlotIds)

    if (slotsForValidation.length > 0) {
      // Verificar se o usuário tem exceção ativa
      const hasException = hasActiveBookingException(body.bookingExceptionUntil)

      // Verificar se o usuário está em posto avançado (completamente isento das regras)
      const isOnOutpost = await deps.outpostsRepository.isUserOnOutpost(userId)

      // Verificar se os slots estão na semana atual (para aplicar exceção)
      const firstSlotDate = new Date(slotsForValidation[0].slotStart)
      const slotsInCurrentWeek = isDateInCurrentWeek(firstSlotDate)

      // VALIDAÇÃO 1: Limite semanal por cargo
      // BYPASS: Ignorado quando:
      // - Há exceção ativa E slots estão na semana atual, OU
      // - Usuário está em posto avançado
      const userPosition =
        await deps.teamPositionsRepository.findByUserId(userId)

      if (
        userPosition &&
        POSITIONS_WITH_LIMITS.includes(userPosition.position)
      ) {
        const weeklyLimit = WEEKLY_WORKSTATION_LIMITS[userPosition.position]

        // Obter todas as datas únicas dos slots sendo solicitados (apenas a data, sem hora)
        // IMPORTANTE: Usamos UTC para normalizar as datas e evitar problemas de timezone
        const requestedDates = new Set(
          slotsForValidation.map((slot) => {
            const date = new Date(slot.slotStart)
            // Usar UTC para garantir consistência: YYYY-MM-DD em UTC
            const year = date.getUTCFullYear()
            const month = String(date.getUTCMonth() + 1).padStart(2, '0')
            const day = String(date.getUTCDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }),
        )

        // Determinar a semana dos slots solicitados
        // CORREÇÃO CRÍTICA: Usar a data do primeiro slot, não a data atual!
        const firstSlotDate = new Date(slotsForValidation[0].slotStart)
        const weekStart = startOfWeek(firstSlotDate, { weekStartsOn: 0 }) // Domingo
        const weekEnd = endOfWeek(firstSlotDate, { weekStartsOn: 0 }) // Sábado

        // Buscar todas as reservas de workstation do usuário na mesma semana dos slots
        const existingReservations =
          await deps.spaceReservationRepository.listReservations(1, 100, {
            userId: userId,
            startDate: weekStart.toISOString(),
            endDate: weekEnd.toISOString(),
            status: 'reserved',
          })

        // Filtrar apenas reservas de workstation e obter datas únicas
        // IMPORTANTE: Usar a mesma normalização UTC para comparação consistente
        const existingWorkstationDates = new Set<string>()
        existingReservations.reservations.forEach((reservation) => {
          if (reservation.space.type === 'workstation') {
            // Cada reserva tem um slotRange [start, end]
            const resDate = new Date(reservation.slotRange[0])
            // Usar UTC para garantir consistência: YYYY-MM-DD em UTC
            const year = resDate.getUTCFullYear()
            const month = String(resDate.getUTCMonth() + 1).padStart(2, '0')
            const day = String(resDate.getUTCDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`
            existingWorkstationDates.add(dateStr)
          }
        })

        // Contar quantos NOVOS dias estão sendo solicitados (que ainda não têm reserva)
        const newDaysCount = Array.from(requestedDates).filter(
          (date) => !existingWorkstationDates.has(date),
        ).length

        // Calcular total de dias reservados (existentes + novos)
        const totalDaysReserved = existingWorkstationDates.size + newDaysCount

        // Verificar se ultrapassa o limite do cargo
        // BYPASS: Ignorado quando:
        // - Há exceção ativa E slots estão na semana atual, OU
        // - Usuário está em posto avançado (completamente isento)
        const shouldBypassLimitValidation =
          (hasException && slotsInCurrentWeek) || isOnOutpost

        if (totalDaysReserved > weeklyLimit && !shouldBypassLimitValidation) {
          const positionName =
            userPosition.position === 'manager'
              ? 'Gerente'
              : userPosition.position === 'assistant_manager'
                ? 'Subgerente'
                : 'Assistente'

          throw new BadRequestError({
            message: `Limite de reservas semanais excedido para ${positionName}`,
            action: `Como ${positionName}, você pode reservar no máximo ${weeklyLimit} dia${weeklyLimit > 1 ? 's' : ''} de workstation por semana. Você já possui ${existingWorkstationDates.size} dia${existingWorkstationDates.size !== 1 ? 's' : ''} reservado${existingWorkstationDates.size !== 1 ? 's' : ''} e está tentando adicionar mais ${newDaysCount}. Por favor, cancele reservas existentes ou escolha menos dias.`,
            details: {
              where: 'reservation.create',
              position: userPosition.position,
              positionName,
              weeklyLimit,
              existingDaysCount: existingWorkstationDates.size,
              newDaysCount,
              totalDaysReserved,
              requestedDates: Array.from(requestedDates),
              existingDates: Array.from(existingWorkstationDates),
            },
          })
        }

        /**
         * VALIDAÇÃO DE SEGUNDA OU SEXTA-FEIRA OBRIGATÓRIA
         *
         * Para cargos com limite (Gerente, Subgerente, Assistente), é obrigatório
         * incluir pelo menos UMA segunda-feira OU sexta-feira entre os dias reservados.
         *
         * IMPORTANTE: Esta validação só é aplicada quando o usuário COMPLETA seu limite
         * de dias (2 para gerente, 3 para subgerente/assistente).
         *
         * BYPASS: Ignorado quando:
         * - Há exceção ativa E slots estão na semana atual, OU
         * - Usuário está em posto avançado (completamente isento)
         *
         * Exemplos:
         * - Gerente com 1 dia (terça): PERMITE (ainda pode adicionar mais 1)
         * - Gerente com 2 dias (terça + quarta): BLOQUEIA (completou sem segunda/sexta)
         * - Gerente com 2 dias (terça + segunda): PERMITE (completou com segunda)
         */
        // Só validar segunda/sexta quando completar o limite de dias E NÃO tiver bypass ativo
        if (totalDaysReserved >= weeklyLimit && !shouldBypassLimitValidation) {
          // Combinar todas as datas da semana (existentes + novas solicitações)
          const allWeekDays = new Set([
            ...existingWorkstationDates,
            ...requestedDates,
          ])

          // Verificar se pelo menos um dia é segunda (1) ou sexta (5)
          const hasRequiredDay = Array.from(allWeekDays).some((dateStr) => {
            const date = new Date(dateStr + 'T12:00:00.000Z') // Meio-dia UTC para evitar edge cases
            const dayOfWeek = date.getUTCDay() // 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
            return dayOfWeek === 1 || dayOfWeek === 5
          })

          if (!hasRequiredDay) {
            const positionName =
              userPosition.position === 'manager'
                ? 'Gerente'
                : userPosition.position === 'assistant_manager'
                  ? 'Subgerente'
                  : 'Assistente'

            throw new BadRequestError({
              message:
                'É obrigatório incluir uma segunda-feira ou sexta-feira entre os dias reservados',
              action: `Como ${positionName}, você deve incluir pelo menos um dia que seja segunda-feira ou sexta-feira em suas reservas semanais. Por favor, ajuste sua seleção de dias.`,
              details: {
                where: 'reservation.create',
                position: userPosition.position,
                positionName,
                allWeekDays: Array.from(allWeekDays),
                reason: 'missing_monday_or_friday',
              },
            })
          }
        }
      }

      // VALIDAÇÃO 2: Apenas uma reserva de workstation por dia
      // Obter todas as datas únicas dos slots (apenas a data, sem hora)
      const slotDates = new Set(
        slotsForValidation.map((slot) => {
          const date = new Date(slot.slotStart)
          return date.toISOString().split('T')[0] // Formato: YYYY-MM-DD
        }),
      )

      // Para cada data, verificar se já existe reserva de workstation
      for (const dateStr of slotDates) {
        // Criar intervalo do dia completo (00:00 até 23:59:59.999)
        const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
        const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

        const existingReservations =
          await deps.spaceReservationRepository.listReservations(1, 1, {
            userId: userId,
            startDate: dayStart.toISOString(),
            endDate: dayEnd.toISOString(),
            status: 'reserved',
          })

        // Verificar se alguma das reservas existentes é de uma workstation
        const hasWorkstationReservation =
          existingReservations.reservations.some(
            (reservation) => reservation.space.type === 'workstation',
          )

        if (hasWorkstationReservation) {
          throw new BadRequestError({
            message: `Você já possui uma reserva de workstation para o dia ${dateStr.split('-').reverse().join('/')}`,
            action:
              'Cancele a reserva existente ou escolha outro dia para criar uma nova reserva de workstation',
            details: {
              where: 'reservation.create',
              userId,
              spaceId,
              spaceType: space.type,
              conflictDate: dateStr,
              reason: 'workstation_already_reserved_same_day',
            },
          })
        }
      }
    }
  }

  // Buscar todos os slots de uma vez para processamento em memória
  // OTIMIZAÇÃO: Usa findByIds para buscar todos de uma vez (1 query ao invés de N)
  const allSlots = await deps.spaceSlotRepository.findByIds(spaceSlotIds)

  // Verificar se todos os slots foram encontrados
  if (allSlots.length !== spaceSlotIds.length) {
    throw new NotFoundError({
      message: 'Um ou mais slots de tempo não foram encontrados',
      action: 'Verifique os IDs dos slots e tente novamente',
      details: {
        where: 'reservation.create',
        spaceId,
        userId,
        requestedSlotIds: spaceSlotIds,
        foundSlotsCount: allSlots.length,
        expectedSlotsCount: spaceSlotIds.length,
      },
    })
  }

  // Validar todos os slots antes de prosseguir
  for (const slot of allSlots) {
    if (!slot) {
      throw new NotFoundError({
        message: 'Slot de tempo não encontrado',
        action: 'Verifique o ID do slot e tente novamente',
        details: {
          where: 'reservation.create',
          spaceId,
          userId,
          spaceSlotIds,
        },
      })
    }
    if (slot.spaceId !== spaceId) {
      throw new BadRequestError({
        message: 'O slot de tempo não pertence ao espaço especificado',
        action: 'Verifique se o spaceId e o spaceSlotId são compatíveis',
        details: {
          where: 'reservation.create',
          slotId: slot.id,
          slotSpaceId: slot.spaceId,
          requestedSpaceId: spaceId,
          userId,
        },
      })
    }
    if (slot.status !== 'pre_reserved') {
      throw new ConflictError({
        message: 'O slot de tempo não está disponível para reserva',
        action:
          'Este horário não está pré-reservado ou já foi reservado por outro usuário',
        details: {
          where: 'reservation.create',
          slotId: slot.id,
          slotStatus: slot.status,
          expectedStatus: 'pre_reserved',
          spaceId,
          userId,
        },
      })
    }
    if (slot.userId !== userId) {
      throw new BadRequestError({
        message:
          'Você não pode reservar um slot pré-reservado por outro usuário',
        action: 'Selecione um slot que você tenha pré-reservado',
        details: {
          where: 'reservation.create',
          slotId: slot.id,
          slotUserId: slot.userId,
          requestUserId: userId,
          spaceId,
        },
      })
    }
    const now = new Date()
    const preReservedUntil = slot.preReservedUntil
      ? new Date(slot.preReservedUntil)
      : null
    if (!preReservedUntil || now > preReservedUntil) {
      throw new ConflictError({
        message: 'A pré-reserva expirou',
        action:
          'O tempo de 5 minutos para confirmar a pré-reserva foi excedido. Por favor, faça uma nova pré-reserva.',
        details: {
          where: 'reservation.create',
          slotId: slot.id,
          preReservedUntil: preReservedUntil?.toISOString(),
          currentTime: now.toISOString(),
          spaceId,
          userId,
        },
      })
    }
  }

  // Verificar se a solicitação de copeira pode ser aceita (mínimo de 24 horas de antecedência)
  if (needsCopeira) {
    const now = new Date()
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Verificar se algum slot começa antes do prazo mínimo de 24 horas
    const hasSlotBefore24Hours = allSlots.some((slot) => {
      const slotStartDate = new Date(slot.slotStart)
      return slotStartDate < twentyFourHoursFromNow
    })

    if (hasSlotBefore24Hours) {
      throw new BadRequestError({
        message:
          'Não é possível solicitar serviço de copeira com menos de 24 horas de antecedência',
        action:
          'Solicite o serviço de copeira apenas para reservas com mais de 24 horas de antecedência ou remova esta opção da sua reserva',
        details: {
          where: 'reservation.create',
          spaceId,
          userId,
          needsCopeira,
          slotsCount: allSlots.length,
          minimumHoursRequired: 24,
          reason: 'copeira_requires_24h_advance',
        },
      })
    }
  }

  // Ordenar slots por horário de início para garantir sequência cronológica
  const sortedSlots = [...allSlots].sort((slotA, slotB) =>
    slotA.slotStart.localeCompare(slotB.slotStart),
  )

  /**
   * ALGORITMO DE AGRUPAMENTO DE SLOTS
   *
   * WORKSTATIONS:
   * Para workstations, agrupa TODOS os slots do mesmo dia em uma única reserva,
   * independentemente de terem intervalos (ex: manhã 08:00-12:00 e tarde 13:00-17:00).
   * Isso simplifica o processo de check-in/check-out, exigindo apenas 1 check-in
   * e 1 check-out por dia, mesmo que o usuário tenha reservado períodos com intervalo.
   *
   * ROOMS (SALAS):
   * Para salas, mantém o comportamento original: agrupa apenas slots sequenciais
   * (quando o fim de um é igual ao início do próximo). Slots com intervalos ou
   * de dias diferentes geram reservas separadas.
   *
   * Exemplo Workstation:
   * - Slot1: 08:00-12:00 (manhã)
   * - Slot2: 13:00-17:00 (tarde)
   * → 1 única reserva das 08:00 às 17:00
   *
   * Exemplo Room:
   * - Slot1: 08:00-09:00
   * - Slot2: 09:00-10:00
   * - Slot3: 14:00-15:00
   * → 2 reservas: uma das 08:00-10:00 e outra das 14:00-15:00
   */
  const slotGroups: SlotGroup[] = []

  if (space.type === 'workstation') {
    // WORKSTATION: Agrupar por dia (ignora intervalos)
    const slotsByDay = new Map<string, SpaceSlot[]>()

    // Agrupar slots por data (YYYY-MM-DD)
    for (const slot of sortedSlots) {
      const date = new Date(slot.slotStart).toISOString().split('T')[0]
      if (!slotsByDay.has(date)) {
        slotsByDay.set(date, [])
      }
      slotsByDay.get(date)!.push(slot)
    }

    // Criar um grupo para cada dia
    for (const [date, slotsOfDay] of slotsByDay) {
      // Ordenar slots do dia
      const sortedDaySlots = slotsOfDay.sort((a, b) =>
        a.slotStart.localeCompare(b.slotStart),
      )

      slotGroups.push({
        slotIds: sortedDaySlots.map((s) => s.id),
        startTime: sortedDaySlots[0].slotStart, // Primeiro slot do dia
        endTime: sortedDaySlots[sortedDaySlots.length - 1].slotEnd, // Último slot do dia
        slots: sortedDaySlots,
      })
    }
  } else {
    // ROOM: Agrupar apenas slots sequenciais (comportamento original)
    let currentGroup: SlotGroup | null = null

    for (const slotObj of sortedSlots) {
      if (!currentGroup) {
        // Iniciar um novo grupo com o primeiro slot
        currentGroup = {
          slotIds: [slotObj.id],
          startTime: slotObj.slotStart,
          endTime: slotObj.slotEnd,
          slots: [slotObj],
        }
      } else if (currentGroup.endTime === slotObj.slotStart) {
        // Slot sequencial - adicionar ao grupo atual
        // (o fim do último slot é igual ao início deste)
        currentGroup.slotIds.push(slotObj.id)
        currentGroup.endTime = slotObj.slotEnd // Atualiza o fim do grupo
        currentGroup.slots.push(slotObj)
      } else {
        // Não é sequencial - finaliza o grupo atual e inicia um novo
        slotGroups.push(currentGroup)
        currentGroup = {
          slotIds: [slotObj.id],
          startTime: slotObj.slotStart,
          endTime: slotObj.slotEnd,
          slots: [slotObj],
        }
      }
    }

    // Adicionar o último grupo se existir
    if (currentGroup) {
      slotGroups.push(currentGroup)
    }
  }

  // Para cada grupo de slots, criar uma única reserva
  const reservations: SpaceReservationCreateResponse['reservations'] = []

  for (const group of slotGroups) {
    /**
     * CRIAÇÃO DE RESERVA COM MÚLTIPLOS SLOTS
     *
     * Cada reserva agora:
     * 1. Contém um array de IDs de slots (spaceSlotIds)
     * 2. Tem um intervalo completo do início do primeiro ao fim do último slot
     * 3. Representa uma única linha na tabela de reservas
     *
     * Esta abordagem reduz redundância de dados e simplifica o modelo de negócio,
     * onde uma reserva lógica = uma linha na tabela.
     */
    const reservation = await deps.spaceReservationRepository.create({
      spaceId,
      userId,
      slotRange: [group.startTime, group.endTime],
      spaceSlotIds: group.slotIds, // Array de IDs dos slots como JSONB
      bbzCollaborators,
      externalGuests,
      needsCopeira,
    })

    // Atualizar o status de todos os slots no grupo para "reserved"
    await Promise.all(
      group.slotIds.map((slotId) =>
        deps.spaceSlotRepository.updateSpaceSlot({
          slotId,
          status: 'reserved',
        }),
      ),
    )

    // Adicionar à lista de reservas criadas
    reservations.push({
      id: reservation.id,
      spaceId: reservation.spaceId,
      userId: reservation.userId,
      slotStart: reservation.slotRange[0],
      slotEnd: reservation.slotRange[1],
      spaceSlotIds: reservation.spaceSlotIds,
      bbzCollaborators: reservation.bbzCollaborators,
      externalGuests: reservation.externalGuests,
      needsCopeira: reservation.needsCopeira,
      status: reservation.status,
    })
  }

  // Montar email de copia
  let cc: string | undefined = undefined
  // Pega todos os colaboradores e convidados de todas as reservas
  const allCollaborators = reservations.flatMap((r) => r.bbzCollaborators)
  const allExternalGuests = reservations.flatMap((r) => r.externalGuests)
  if (allCollaborators.length > 0) {
    cc = allCollaborators.join(',')
  }
  if (allExternalGuests.length > 0) {
    cc = cc
      ? `${cc},${allExternalGuests.join(',')}`
      : allExternalGuests.join(',')
  }

  // Formatar horários para o email
  // Nota: Os slots já foram agrupados, então não precisamos consolidar novamente no ICS
  const schedulesFormatted = slotGroups
    .map((group) => {
      const tz = 'America/Sao_Paulo'
      const start = toZonedTime(new Date(group.startTime), tz)
      const end = toZonedTime(new Date(group.endTime), tz)
      return {
        date: formatTz(start, 'dd/MM/yyyy', { timeZone: tz }),
        startTime: formatTz(start, 'HH:mm', { timeZone: tz }),
        endTime: formatTz(end, 'HH:mm', { timeZone: tz }),
        _sortKey: group.startTime, // ISO para ordenação
      }
    })
    .sort((a, b) => a._sortKey.localeCompare(b._sortKey))
    .map(({ _sortKey, ...rest }) => rest)

  // Criar conteúdo ICS
  const icsContent = generateICSSpaceReservation({
    spaceName: space.name,
    userEmail: user.email as string,
    userName: user.name as string,
    schedules: schedulesFormatted,
  })

  const attachment = {
    filename: 'reserva-bbz.ics',
    content: icsContent,
    contentType: 'text/calendar',
  }

  // Enviar email de confirmação
  await sendEmail({
    type: 'SPACE_RESERVATION_CONFIRMATION',
    data: {
      spaceName: space.name,
      userName: user.name as string,
      schedules: schedulesFormatted,
    },
    to: user.email,
    cc,
    userId,
    attachments: [attachment],
  })

  return {
    reservations,
    message:
      reservations.length === 1
        ? 'Reserva criada com sucesso'
        : 'Reservas criadas com sucesso',
  }
}

export const createSpaceReservationSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
  409: ConflictErrorSchema,
}
