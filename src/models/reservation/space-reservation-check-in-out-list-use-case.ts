import {
  BadRequestErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { database } from '@/infra/database'
import { NotFoundError } from '@/infra/errors'
import { UserAccountContext } from '@/repositories/base/users-repository'
import {
  CheckInOutListParamsInput,
  CheckInOutListResponse,
} from '@/schemas/reservation/space-reservation-check-in-out-list-schema'

interface InputProps {
  user: UserAccountContext
  params: CheckInOutListParamsInput
}

export async function listCheckInOutReservations(
  input: InputProps,
): Promise<CheckInOutListResponse> {
  const { spaceId } = input.params
  const userId = input.user.id
  const userEmail = input.user.email

  // 1. Buscar o espaço
  const spaceResult = await database.query({
    text: `SELECT id, name, type FROM spaces WHERE id = $1 LIMIT 1`,
    values: [spaceId],
  })

  if (spaceResult.rows.length === 0) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique se o QR Code é válido ou se o espaço está disponível',
      details: { where: 'checkInOutList', spaceId },
    })
  }

  const space = spaceResult.rows[0]

  // 2. Calcular início e fim do dia brasileiro (BRT = UTC-3) no servidor
  const now = new Date()
  const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000
  const brazilTime = new Date(now.getTime() + BRAZIL_OFFSET_MS)
  const year = brazilTime.getUTCFullYear()
  const month = brazilTime.getUTCMonth()
  const day = brazilTime.getUTCDate()

  const startOfDay = new Date(
    Date.UTC(year, month, day, 3, 0, 0, 0),
  ).toISOString()
  const endOfDay = new Date(
    Date.UTC(year, month, day + 1, 2, 59, 59, 999),
  ).toISOString()

  // 3. Buscar reservas do dia para o usuário (como dono OU convidado) neste espaço
  const reservationsResult = await database.query({
    text: `
      SELECT
        sr.id,
        sr.slot_range,
        sr.status,
        sr.user_id
      FROM space_reservations sr
      WHERE sr.space_id = $1
        AND sr.status = 'reserved'
        AND lower(sr.slot_range) >= $2
        AND upper(sr.slot_range) <= $3
        AND (
          sr.user_id = $4
          OR sr.bbz_collaborators @> $5::jsonb
          OR sr.external_guests @> $5::jsonb
        )
      ORDER BY lower(sr.slot_range) ASC
    `,
    values: [
      spaceId,
      startOfDay,
      endOfDay,
      userId,
      JSON.stringify([userEmail]),
    ],
  })

  // 4. Buscar check-in/outs para cada reserva encontrada
  const reservations: CheckInOutListResponse['reservations'] = []

  for (const row of reservationsResult.rows) {
    const slotRange = row.slot_range
      .replace(/[()[\]]/g, '')
      .split(',')
      .map((d: string) => new Date(d.trim()).toISOString())

    const checkInOutsResult = await database.query({
      text: `
        SELECT
          scio.id,
          scio.user_id,
          u.name as user_name,
          scio.type,
          scio.created_at
        FROM space_check_in_out scio
        JOIN users u ON u.id = scio.user_id
        WHERE scio.reservation_id = $1
        ORDER BY scio.created_at ASC
      `,
      values: [row.id],
    })

    reservations.push({
      id: row.id,
      slotStart: slotRange[0],
      slotEnd: slotRange[1],
      status: row.status,
      isOwner: row.user_id === userId,
      checkInOuts: checkInOutsResult.rows.map((ci: any) => ({
        id: ci.id,
        userId: ci.user_id,
        userName: ci.user_name,
        type: ci.type,
        createdAt: ci.created_at.toISOString(),
      })),
    })
  }

  return {
    spaceName: space.name,
    spaceType: space.type,
    reservations,
  }
}

export const listCheckInOutReservationsSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
}
