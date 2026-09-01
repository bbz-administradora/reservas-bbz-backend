// src/repositories/pg/pg-space-slot-repository.ts
import { database } from '@/infra/database'
import { BadRequestError, ConflictError, DatabaseError } from '@/infra/errors'
import {
  AvailableSpace,
  ISpaceSlotRepository,
  PaginatedAvailableSpaces,
  SpaceSlot,
  SpaceSlotCreate,
  SpaceSlotDb,
  SpaceSlotUpdate,
  SpaceSlotWithUser,
  SpaceWithSlots,
} from '../base/space-slot-repository'

export class PgSpaceSlotRepository implements ISpaceSlotRepository {
  /**
   * Cria uma pré-reserva de espaço
   *
   * NOTA: Este método trata race conditions automaticamente.
   * Se duas requisições tentarem criar o mesmo slot simultaneamente,
   * a constraint `no_overlapping_slots_per_space` vai rejeitar a segunda
   * e este método vai lançar um ConflictError amigável.
   */
  async createPreReservation(input: SpaceSlotCreate): Promise<SpaceSlot> {
    if (
      !input.spaceId ||
      !input.userId ||
      !input.slotStart ||
      !input.slotEnd ||
      !input.preReservedUntil
    ) {
      throw new BadRequestError({
        message: 'Dados incompletos para criar pré-reserva',
        action:
          'Forneça spaceId, userId, slotStart, slotEnd e preReservedUntil válidos',
      })
    }

    // Converter as datas para objetos Date
    const startDate = new Date(input.slotStart)
    const endDate = new Date(input.slotEnd)
    const preReservedUntil = new Date(input.preReservedUntil)

    const query = {
      text: `
        INSERT INTO space_slots (
          space_id,
          slot_range,
          status,
          user_id,
          pre_reserved_until
        ) VALUES (
          $1,
          tstzrange($2, $3, '[)'),
          $4,
          $5,
          $6
        ) RETURNING
          id,
          space_id,
          slot_range,
          status,
          user_id,
          pre_reserved_until,
          created_at,
          updated_at
      `,
      values: [
        input.spaceId,
        startDate.toISOString(),
        endDate.toISOString(),
        input.status,
        input.userId,
        preReservedUntil.toISOString(),
      ],
    }

    try {
      const result = await database.query(query)

      if (!result.rows[0]) {
        throw new DatabaseError({
          message: 'Falha ao criar pré-reserva',
          action: 'Verifique os dados e tente novamente',
        })
      }

      return this.mapToSpaceSlot(result.rows[0])
    } catch (error: any) {
      // Tratar erro de constraint de exclusão (race condition)
      // Código 23P01 = exclusion_violation (outra requisição criou o mesmo slot)
      if (error.code === '23P01') {
        throw new ConflictError({
          message: 'Este horário acabou de ser reservado por outra pessoa',
          action: 'Selecione outro horário ou tente novamente em instantes',
          details: {
            where: 'spaceSlotRepository.createPreReservation',
            spaceId: input.spaceId,
            slotStart: input.slotStart,
            slotEnd: input.slotEnd,
            constraint: error.constraint,
            reason: 'race_condition_slot_conflict',
          },
        })
      }

      // Código 23505 = unique_violation (também pode ocorrer em race conditions)
      if (error.code === '23505') {
        throw new ConflictError({
          message: 'Este horário já está reservado',
          action: 'Selecione outro horário para este espaço',
          details: {
            where: 'spaceSlotRepository.createPreReservation',
            spaceId: input.spaceId,
            slotStart: input.slotStart,
            slotEnd: input.slotEnd,
            constraint: error.constraint,
            reason: 'unique_violation_slot_conflict',
          },
        })
      }

      // Se for outro erro, propaga como DatabaseError ou re-lança se já for um erro tratado
      if (error instanceof BadRequestError || error instanceof ConflictError) {
        throw error
      }

      throw new DatabaseError({
        message: 'Falha ao criar pré-reserva',
        action: 'Verifique os dados e tente novamente',
        details: {
          where: 'spaceSlotRepository.createPreReservation',
          originalError: error.message,
          code: error.code,
        },
      })
    }
  }

  /**
   * Deleta uma pré-reserva por ID
   * A verificação se o usuário é o dono deve ser feita no caso de uso, não no repositório
   */
  async deleteById(slotId: string): Promise<void> {
    if (!slotId) {
      throw new BadRequestError({
        message: 'ID do slot é obrigatório para deletar',
        action: 'Forneça um slotId válido',
      })
    }

    const query = {
      text: `
        DELETE FROM space_slots
        WHERE id = $1
      `,
      values: [slotId],
    }

    await database.query(query)
  }

  async deleteAllBySpaceId(spaceId: string): Promise<void> {
    if (!spaceId) {
      throw new BadRequestError({
        message: 'ID do espaço é obrigatório para deletar todos os slots',
        action: 'Forneça um spaceId válido',
      })
    }

    const query = {
      text: `
        DELETE FROM space_slots
        WHERE space_id = $1
      `,
      values: [spaceId],
    }

    await database.query(query)
  }

  /**
   * Deleta múltiplos slots de uma vez por seus IDs.
   * OTIMIZAÇÃO: Reduz de N DELETE queries para 1 único DELETE com ANY().
   *
   * @param slotIds Array de IDs dos slots a serem deletados
   * @example
   * // Antes (8 slots = 8 queries):
   * for (const id of slotIds) await deleteById(id)
   *
   * // Depois (8 slots = 1 query):
   * await deleteByIds(slotIds)
   */
  async deleteByIds(slotIds: string[]): Promise<void> {
    if (!slotIds || slotIds.length === 0) {
      return // Nada para deletar
    }

    const query = {
      text: `
        DELETE FROM space_slots
        WHERE id = ANY($1::uuid[])
      `,
      values: [slotIds],
    }

    await database.query(query)
  }

  /**
   * Confirma uma pré-reserva, alterando seu status para 'reserved'
   */
  async confirmReservation(slotId: string, userId: string): Promise<SpaceSlot> {
    if (!slotId || !userId) {
      throw new BadRequestError({
        message:
          'ID do slot e ID do usuário são obrigatórios para confirmar a reserva',
        action: 'Forneça slotId e userId válidos',
      })
    }

    const query = {
      text: `
        UPDATE space_slots
        SET
          status = 'reserved',
          updated_at = (now() AT TIME ZONE 'utc')
        WHERE id = $1
          AND user_id = $2
          AND status = 'pre_reserved'
        RETURNING
          id,
          space_id,
          slot_range,
          status,
          user_id,
          pre_reserved_until,
          created_at,
          updated_at
      `,
      values: [slotId, userId],
    }

    const result = await database.query(query)

    if (result.rows.length === 0) {
      throw new BadRequestError({
        message:
          'Pré-reserva não encontrada ou você não tem permissão para confirmá-la',
        action:
          'Verifique o ID do slot e confirme se você é o proprietário desta pré-reserva',
      })
    }

    return this.mapToSpaceSlot(result.rows[0])
  }

  async findById(slotId: string): Promise<SpaceSlot | null> {
    if (!slotId) {
      throw new BadRequestError({
        message: 'slotId é obrigatório para busca',
        action: 'Forneça um slotId válido',
      })
    }

    const query = {
      text: `
        SELECT *
        FROM space_slots
        WHERE id = $1
        LIMIT 1
      `,
      values: [slotId],
    }
    const result = await database.query(query)
    if (result.rows.length === 0) return null
    return this.mapToSpaceSlot(result.rows[0])
  }

  /**
   * Busca múltiplos slots de uma vez por seus IDs.
   * OTIMIZAÇÃO: Reduz de N SELECT queries para 1 único SELECT com ANY().
   *
   * @param slotIds Array de IDs dos slots a serem buscados
   * @returns Array de slots encontrados (pode ter menos itens que slotIds se alguns não existirem)
   * @example
   * // Antes (8 slots = 8 queries):
   * const slots = await Promise.all(slotIds.map(id => findById(id)))
   *
   * // Depois (8 slots = 1 query):
   * const slots = await findByIds(slotIds)
   */
  async findByIds(slotIds: string[]): Promise<SpaceSlot[]> {
    if (!slotIds || slotIds.length === 0) {
      return [] // Nada para buscar
    }

    const query = {
      text: `
        SELECT *
        FROM space_slots
        WHERE id = ANY($1::uuid[])
      `,
      values: [slotIds],
    }

    const result = await database.query(query)
    return result.rows.map((row: SpaceSlotDb) => this.mapToSpaceSlot(row))
  }

  /**
   * Encontra um slot específico por espaço e horário de início
   */
  async findBySpaceAndStart(
    spaceId: string,
    slotStart: string,
  ): Promise<SpaceSlot | null> {
    if (!spaceId || !slotStart) {
      throw new BadRequestError({
        message: 'ID do espaço e horário de início são obrigatórios',
        action: 'Forneça spaceId e slotStart válidos',
      })
    }

    const startDate = new Date(slotStart)

    // OTIMIZAÇÃO: Ignora pré-reservas expiradas (pre_reserved_until < NOW())
    // Isso permite que um slot seja considerado disponível instantaneamente após expirar,
    // sem precisar aguardar o job de cleanup. O job apenas limpa os dados posteriormente.
    const query = {
      text: `
        SELECT
          id,
          space_id,
          slot_range,
          status,
          user_id,
          pre_reserved_until,
          created_at,
          updated_at
        FROM space_slots
        WHERE space_id = $1
          AND slot_range @> $2::timestamptz
          AND NOT (status = 'pre_reserved' AND pre_reserved_until < NOW())
      `,
      values: [spaceId, startDate.toISOString()],
    }

    const result = await database.query(query)

    if (result.rows.length === 0) {
      return null
    }

    const slotDb = result.rows[0]
    const slotRange = this.parseRange(slotDb.slot_range)

    return {
      id: slotDb.id,
      spaceId: slotDb.space_id,
      slotStart: slotRange[0].toISOString(),
      slotEnd: slotRange[1].toISOString(),
      status: slotDb.status,
      userId: slotDb.user_id,
      preReservedUntil: slotDb.pre_reserved_until?.toISOString() || null,
      createdAt: slotDb.created_at.toISOString(),
      updatedAt: slotDb.updated_at.toISOString(),
    }
  }

  /**
   * Lista espaços disponíveis com pelo menos um slot livre na data especificada
   *
   * Para rooms: considera slots de 1 hora (13 slots de 07:00 às 20:00)
   * Para workstations: considera 2 períodos fixos (manhã: 07:00-12:00, tarde: 13:00-18:00)
   */
  async listAvailableSpacesByDate(
    date: string,
    page: number = 1,
    pageSize: number = 20,
    startHour: string = '07:00',
    endHour: string = '20:00',
    timeZoneOffset: string = '-03:00',
    type: 'room' | 'workstation' = 'room',
  ): Promise<PaginatedAvailableSpaces> {
    if (!date) {
      throw new BadRequestError({
        message: 'Data é obrigatória',
        action: 'Forneça uma data válida no formato YYYY-MM-DD',
      })
    }

    // Criar objetos Date conforme os parâmetros recebidos
    const localDateStart = new Date(`${date}T${startHour}${timeZoneOffset}`)
    const localDateEnd = new Date(`${date}T${endHour}${timeZoneOffset}`)

    // Para workstations, definir os períodos fixos de manhã e tarde
    const morningStart = new Date(`${date}T07:00${timeZoneOffset}`)
    const morningEnd = new Date(`${date}T12:00${timeZoneOffset}`)
    const afternoonStart = new Date(`${date}T13:00${timeZoneOffset}`)
    const afternoonEnd = new Date(`${date}T18:00${timeZoneOffset}`)

    // Paginação
    const offset = (page - 1) * pageSize

    // Query diferenciada por tipo de espaço
    // Para workstations: verifica se tem pelo menos 1 dos 2 períodos (manhã/tarde) disponível
    // Para rooms: verifica se tem pelo menos 1 slot de 1 hora disponível
    let query
    let countQuery

    if (type === 'workstation') {
      // Para workstations: verifica disponibilidade nos períodos fixos de manhã e tarde
      query = {
        text: `
          WITH workstation_availability AS (
            SELECT
              s.id AS space_id,
              -- Verifica se o período da manhã está ocupado
              -- OTIMIZAÇÃO: Ignora pré-reservas expiradas (libera slot instantaneamente)
              EXISTS (
                SELECT 1 FROM space_slots ss
                WHERE ss.space_id = s.id
                  AND ss.slot_range && tstzrange($1, $2, '[)')
                  AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
              ) AS morning_occupied,
              -- Verifica se o período da tarde está ocupado
              EXISTS (
                SELECT 1 FROM space_slots ss
                WHERE ss.space_id = s.id
                  AND ss.slot_range && tstzrange($3, $4, '[)')
                  AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
              ) AS afternoon_occupied
            FROM
              spaces s
            WHERE
              s.is_active = true
              AND s.type = 'workstation'
          )
          SELECT
            s.id,
            s.name,
            s.description,
            s.recursos,
            s.imagens,
            s.capacidade,
            s.type,
            s.floor,
            s.zone,
            s.position,
            COUNT(*) OVER() AS total_count
          FROM
            spaces s
          JOIN
            workstation_availability wa ON s.id = wa.space_id
          WHERE
            -- Pelo menos um período deve estar disponível
            (wa.morning_occupied = false OR wa.afternoon_occupied = false)
          ORDER BY
            s.name ASC
          LIMIT $5 OFFSET $6
        `,
        values: [
          morningStart.toISOString(),
          morningEnd.toISOString(),
          afternoonStart.toISOString(),
          afternoonEnd.toISOString(),
          pageSize,
          offset,
        ],
      }

      countQuery = {
        text: `
          WITH workstation_availability AS (
            SELECT
              s.id AS space_id,
              EXISTS (
                SELECT 1 FROM space_slots ss
                WHERE ss.space_id = s.id
                  AND ss.slot_range && tstzrange($1, $2, '[)')
                  AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
              ) AS morning_occupied,
              EXISTS (
                SELECT 1 FROM space_slots ss
                WHERE ss.space_id = s.id
                  AND ss.slot_range && tstzrange($3, $4, '[)')
                  AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
              ) AS afternoon_occupied
            FROM
              spaces s
            WHERE
              s.is_active = true
              AND s.type = 'workstation'
          )
          SELECT
            COUNT(s.id) AS total_count
          FROM
            spaces s
          JOIN
            workstation_availability wa ON s.id = wa.space_id
          WHERE
            (wa.morning_occupied = false OR wa.afternoon_occupied = false)
        `,
        values: [
          morningStart.toISOString(),
          morningEnd.toISOString(),
          afternoonStart.toISOString(),
          afternoonEnd.toISOString(),
        ],
      }
    } else {
      // Para rooms: mantém a lógica original de slots de 1 hora
      // OTIMIZAÇÃO: Ignora pré-reservas expiradas para liberar slots instantaneamente
      query = {
        text: `
          WITH occupied_slots AS (
            SELECT
              s.id AS space_id,
              COUNT(ss.id) AS occupied_count
            FROM
              spaces s
            LEFT JOIN
              space_slots ss ON s.id = ss.space_id AND
              ss.slot_range && tstzrange($1, $2, '[)')
              AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
            WHERE
              s.is_active = true
            GROUP BY
              s.id
          ),
          total_possible_slots AS (
            SELECT
              CEILING(
                EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz)) / 3600.0
              )::integer AS total_slots
          )
          SELECT
            s.id,
            s.name,
            s.description,
            s.recursos,
            s.imagens,
            s.capacidade,
            s.type,
            s.floor,
            s.zone,
            s.position,
            COUNT(*) OVER() AS total_count,
            tps.total_slots
          FROM
            spaces s
          JOIN
            occupied_slots os ON s.id = os.space_id
          CROSS JOIN
            total_possible_slots tps
          WHERE
            os.occupied_count < tps.total_slots AND
            s.type = $5
          ORDER BY
            s.name ASC
          LIMIT $3 OFFSET $4
        `,
        values: [
          localDateStart.toISOString(),
          localDateEnd.toISOString(),
          pageSize,
          offset,
          type,
        ],
      }

      countQuery = {
        text: `
          WITH occupied_slots AS (
            SELECT
              s.id AS space_id,
              COUNT(ss.id) AS occupied_count
            FROM
              spaces s
            LEFT JOIN
              space_slots ss ON s.id = ss.space_id AND
              ss.slot_range && tstzrange($1, $2, '[)')
              AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
            WHERE
              s.is_active = true
            GROUP BY
              s.id
          ),
          total_possible_slots AS (
            SELECT
              CEILING(
                EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz)) / 3600.0
              )::integer AS total_slots
          )
          SELECT
            COUNT(s.id) AS total_count
          FROM
            spaces s
          JOIN
            occupied_slots os ON s.id = os.space_id
          CROSS JOIN
            total_possible_slots tps
          WHERE
            os.occupied_count < tps.total_slots AND
            s.type = $3
        `,
        values: [
          localDateStart.toISOString(),
          localDateEnd.toISOString(),
          type,
        ],
      }
    }

    const result = await database.query(query)
    const countResult = await database.query(countQuery)

    const totalCount = parseInt(countResult.rows[0]?.total_count || '0')
    const totalPages = Math.ceil(totalCount / pageSize)

    const spaces: AvailableSpace[] = result.rows.map((row: any) =>
      this.mapToAvailableSpace(row),
    )

    return {
      spaces,
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  /**
   * Lista espaços disponíveis em uma data e hora específicas
   */
  async listAvailableSpacesByDateAndHour(
    date: string, // YYYY-MM-DD
    hour: string, // HH:mm
    page: number = 1,
    pageSize: number = 20,
    durationMinutes: number = 60,
    timeZoneOffset: string = '-03:00',
    type: 'room' | 'workstation' = 'room',
  ): Promise<PaginatedAvailableSpaces> {
    if (!date || !hour) {
      throw new BadRequestError({
        message: 'Data e hora são obrigatórias',
        action: 'Forneça data válida (YYYY-MM-DD) e hora válida (HH:MM)',
      })
    }

    // Criar datetime local completo
    const localStartDateTime = new Date(`${date}T${hour}${timeZoneOffset}`)

    // Calcular horário de término conforme a duração especificada
    const localEndDateTime = new Date(
      localStartDateTime.getTime() + durationMinutes * 60 * 1000,
    )

    // Paginação
    const offset = (page - 1) * pageSize

    // Query para encontrar espaços disponíveis no horário específico
    // OTIMIZAÇÃO: Ignora pré-reservas expiradas para liberar slots instantaneamente
    const query = {
      text: `
        SELECT
          s.id,
          s.name,
          s.description,
          s.recursos,
          s.imagens,
          s.capacidade,
          s.type,
          s.floor,
          s.zone,
          s.position,
          COUNT(*) OVER() AS total_count
        FROM
          spaces s
        WHERE
          s.is_active = true AND
          s.type = $5 AND
          NOT EXISTS (
            SELECT 1 FROM space_slots ss
            WHERE ss.space_id = s.id AND
                  ss.slot_range && tstzrange($1, $2, '[)')
                  AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
          )
        ORDER BY
          s.name ASC
        LIMIT $3 OFFSET $4
      `,
      values: [
        localStartDateTime.toISOString(),
        localEndDateTime.toISOString(),
        pageSize,
        offset,
        type,
      ],
    }

    const countQuery = {
      text: `
        SELECT
          COUNT(s.id) AS total_count
        FROM
          spaces s
        WHERE
          s.is_active = true AND
          s.type = $3 AND
          NOT EXISTS (
            SELECT 1 FROM space_slots ss
            WHERE ss.space_id = s.id AND
                  ss.slot_range && tstzrange($1, $2, '[)')
                  AND NOT (ss.status = 'pre_reserved' AND ss.pre_reserved_until < NOW())
          )
      `,
      values: [
        localStartDateTime.toISOString(),
        localEndDateTime.toISOString(),
        type,
      ],
    }

    const result = await database.query(query)
    const countResult = await database.query(countQuery)

    const totalCount = parseInt(countResult.rows[0]?.total_count || '0')
    const totalPages = Math.ceil(totalCount / pageSize)

    const spaces: AvailableSpace[] = result.rows.map((row: any) =>
      this.mapToAvailableSpace(row),
    )

    return {
      spaces,
      totalCount,
      totalPages,
      currentPage: page,
    }
  }

  /**
   * Obtém a disponibilidade de um espaço em um período específico
   */
  async getSpaceAvailability(
    spaceId: string,
    startDate: string,
    endDate: string,
    startHour: string,
    endHour: string,
    timeZoneOffset: string,
  ): Promise<SpaceWithSlots> {
    if (
      !spaceId ||
      !startDate ||
      !endDate ||
      !startHour ||
      !endHour ||
      !timeZoneOffset
    ) {
      throw new BadRequestError({
        message: 'Dados incompletos para verificar disponibilidade',
        action:
          'Forneça spaceId, startDate, endDate, startHour, endHour e timeZoneOffset válidos',
      })
    }

    // Primeiro, buscar as informações do espaço
    const spaceQuery = {
      text: `
      SELECT
      id,
      name,
      description,
      recursos,
      imagens,
      capacidade,
      type,
      floor,
      zone,
      position,
      is_active as "isActive"
      FROM spaces
      WHERE id = $1
      `,
      values: [spaceId],
    }

    const spaceResult = await database.query(spaceQuery)

    if (spaceResult.rows.length === 0) {
      throw new BadRequestError({
        message: 'Espaço não encontrado',
        action: 'Verifique o ID do espaço e tente novamente',
      })
    }

    const space = spaceResult.rows[0]

    // Criar dateTime completos para início e fim
    const localStartDatetime = new Date(
      `${startDate}T${startHour}${timeZoneOffset}`,
    )
    const localEndDatetime = new Date(`${endDate}T${endHour}${timeZoneOffset}`)

    // Buscar slots ocupados e informações dos usuários
    // OTIMIZAÇÃO: Ignora pré-reservas expiradas para mostrar disponibilidade correta
    const occupiedSlotsQuery = {
      text: `
        SELECT
          rs.id,
          rs.slot_range,
          rs.status,
          rs.user_id,
          rs.pre_reserved_until,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email
        FROM
          space_slots rs
        JOIN
          users u ON rs.user_id = u.id
        WHERE
          rs.space_id = $1 AND
          rs.slot_range && tstzrange($2, $3, '[)')
          AND NOT (rs.status = 'pre_reserved' AND rs.pre_reserved_until < NOW())
      `,
      values: [
        spaceId,
        localStartDatetime.toISOString(),
        localEndDatetime.toISOString(),
      ],
    }

    const occupiedSlotsResult = await database.query(occupiedSlotsQuery)

    // Mapeando os slots ocupados
    const occupiedSlots: SpaceSlotWithUser[] = occupiedSlotsResult.rows.map(
      (row: any) => this.mapToSpaceSlotWithUser(row),
    )

    // Retornar o espaço com seus slots ocupados
    return {
      space: {
        id: space.id,
        name: space.name,
        description: space.description,
        recursos: space.recursos,
        imagens: space.imagens,
        capacidade: space.capacidade,
        isActive: space.isActive,
        type: space.type || 'room', // Default para manter compatibilidade
        floor: space.floor || null,
        zone: space.zone || null,
        position: space.position || null,
      },
      slots: occupiedSlots,
    }
  }

  /**
   * Atualiza um slot de espaço existente
   */
  async updateSpaceSlot(input: SpaceSlotUpdate): Promise<SpaceSlot> {
    if (!input.slotId) {
      throw new BadRequestError({
        message: 'ID do slot é obrigatório para atualização',
        action: 'Forneça o slotId válido',
      })
    }

    // Construir query dinâmica com base nos campos a serem atualizados
    const setClause = []
    const values = [input.slotId] // Primeiro valor é sempre o slotId
    let paramCount = 2 // Começamos do $2 para os parâmetros

    // Status
    if (input.status) {
      setClause.push(`status = $${paramCount}`)
      values.push(input.status)
      paramCount++
    }

    // UserId
    if (input.userId) {
      setClause.push(`user_id = $${paramCount}`)
      values.push(input.userId)
      paramCount++
    }

    // PreReservedUntil
    if (input.preReservedUntil) {
      setClause.push(`pre_reserved_until = $${paramCount}`)
      values.push(new Date(input.preReservedUntil).toISOString())
      paramCount++
    }

    // SlotRange (se tiver alteração de início ou fim)
    if (input.slotStart || input.slotEnd) {
      // Primeiro precisamos buscar o slot atual para manter os valores não alterados
      const currentSlot = await this.findById(input.slotId)
      if (!currentSlot) {
        throw new BadRequestError({
          message: 'Slot não encontrado',
          action: 'Verifique o ID do slot e tente novamente',
        })
      }

      // Usar valores atuais se não forem fornecidos
      const startDate = input.slotStart
        ? new Date(input.slotStart)
        : new Date(currentSlot.slotStart)

      const endDate = input.slotEnd
        ? new Date(input.slotEnd)
        : new Date(currentSlot.slotEnd)

      setClause.push(
        `slot_range = tstzrange($${paramCount}, $${paramCount + 1}, '[)')`,
      )
      values.push(startDate.toISOString(), endDate.toISOString())
      paramCount += 2
    }

    // SpaceId
    if (input.spaceId) {
      setClause.push(`space_id = $${paramCount}`)
      values.push(input.spaceId)
      paramCount++
    }

    // Sempre atualizar o updated_at
    setClause.push(`updated_at = (now() AT TIME ZONE 'utc')`)

    if (setClause.length === 0) {
      // Nada para atualizar
      throw new BadRequestError({
        message: 'Nenhum dado fornecido para atualização',
        action: 'Forneça pelo menos um campo para atualizar',
      })
    }

    const query = {
      text: `
        UPDATE space_slots
        SET ${setClause.join(', ')}
        WHERE id = $1
        RETURNING
          id,
          space_id,
          slot_range,
          status,
          user_id,
          pre_reserved_until,
          created_at,
          updated_at
      `,
      values,
    }

    const result = await database.query(query)

    if (result.rows.length === 0) {
      throw new BadRequestError({
        message: 'Slot não encontrado',
        action: 'Verifique o ID do slot e tente novamente',
      })
    }

    return this.mapToSpaceSlot(result.rows[0])
  }

  /**
   * Função utilitária para parsear o formato de range do PostgreSQL para um array de datas
   */
  private parseRange(rangeStr: string): [Date, Date] {
    // O formato do PostgreSQL para tstzrange é algo como: "[2023-05-01 10:00:00+00,2023-05-01 11:00:00+00)"
    // Precisamos extrair as datas de início e fim

    // Remove os colchetes/parênteses e divide pelo separador de range
    const cleanStr = rangeStr.substring(1, rangeStr.length - 1)
    const [start, end] = cleanStr.split(',')

    return [new Date(start), new Date(end)]
  }

  /**
   * Função para mapear dados do banco para o objeto SpaceSlot
   */
  private mapToSpaceSlot(row: any): SpaceSlot {
    const slotRange = this.parseRange(row.slot_range)

    return {
      id: row.id,
      spaceId: row.space_id,
      slotStart: slotRange[0].toISOString(), // Mantemos em ISO para o cliente
      slotEnd: slotRange[1].toISOString(),
      status: row.status,
      userId: row.user_id,
      preReservedUntil: row.pre_reserved_until?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }
  }

  /**
   * Função para mapear dados do banco para o objeto AvailableSpace
   */
  private mapToAvailableSpace(row: any): AvailableSpace {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      recursos: row.recursos,
      imagens: row.imagens,
      capacidade: row.capacidade,
      type: row.type || 'room', // Default para manter compatibilidade
      floor: row.floor || null,
      zone: row.zone || null,
      position: row.position || null,
    }
  }

  /**
   * Função para mapear dados do banco para o objeto SpaceSlotWithUser
   */
  private mapToSpaceSlotWithUser(row: any): SpaceSlotWithUser {
    const slotRange = this.parseRange(row.slot_range)

    return {
      id: row.id,
      slotStart: slotRange[0].toISOString(),
      slotEnd: slotRange[1].toISOString(),
      status: row.status,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
      },
      preReservedUntil: row.pre_reserved_until?.toISOString() || null,
    }
  }
}
