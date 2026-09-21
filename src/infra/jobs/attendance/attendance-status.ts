import { sendEmail } from '@/utils/email'
import { endOfDay, format, parseISO, subDays } from 'date-fns'
import { format as formatTz, toZonedTime } from 'date-fns-tz'
import { ptBR } from 'date-fns/locale'
import { database } from '../../database'
import { JobContext, JobResult } from '../types'

// Limite de advertências que resulta em banimento automático
const WARNING_COUNT_LIMIT = 5

/**
 * Consolida a presença das reservas encerradas e distribui advertências.
 *
 * Agendado às 06:00 UTC (03:00 em São Paulo).
 *
 * Regras, inalteradas:
 *   - reserva cancelada ou fechada -> `not-applicable`, sem e-mail
 *   - check-in e check-out -> `checked-out`, sem e-mail
 *   - só check-in -> `checked-in`, advertência e e-mail
 *   - nenhum dos dois -> `absent`, advertência e e-mail
 *
 * Ao fim, quem tiver atingido WARNING_COUNT_LIMIT advertências tem a conta
 * desativada e precisa de reativação administrativa.
 */
export async function runAttendanceStatusUpdater(
  ctx: JobContext,
): Promise<JobResult> {
  // Final do dia anterior: só entra reserva que já terminou com folga.
  const endOfYesterday = endOfDay(subDays(new Date(), 1))

  ctx.log.info(
    `🕒 Processando reservas até: ${format(endOfYesterday, 'dd/MM/yyyy HH:mm:ss')} (${endOfYesterday.toISOString()})`,
  )

  const pendingReservationsResult = await database.query({
    text: `
      SELECT
        id,
        user_id,
        bbz_collaborators,
        status,
        attendance_status,
        email_notification_status
      FROM space_reservations
      WHERE attendance_status = 'pending'
      AND upper(slot_range) <= $1::timestamptz
    `,
    values: [endOfYesterday.toISOString()],
  })

  const pendingReservations = pendingReservationsResult.rows

  ctx.log.info(
    `🔍 Encontradas ${pendingReservations.length} reservas com status de presença pendente`,
  )

  const stats = {
    pending: pendingReservations.length,
    notApplicable: 0,
    checkedOut: 0,
    checkedIn: 0,
    absent: 0,
    warnedUsers: 0,
    banned: 0,
    failed: 0,
  }

  for (const reservation of pendingReservations) {
    try {
      // Uma transação por reserva: atualizar o status e somar a advertência
      // precisam valer como um fato só. Fora de transação, morrer entre as duas
      // perde a advertência para sempre — a reserva já não está mais `pending`
      // e nenhuma reexecução a encontra.
      const resultado = await database.withTransaction(async (client) => {
        const checkInOutsResult = await client.query({
          text: `
            SELECT type
            FROM space_check_in_out
            WHERE reservation_id = $1
          `,
          values: [reservation.id],
        })

        const checkInOuts = checkInOutsResult.rows
        const hasCheckIn = checkInOuts.some(
          (c: { type: string }) => c.type === 'check-in',
        )
        const hasCheckOut = checkInOuts.some(
          (c: { type: string }) => c.type === 'check-out',
        )

        let newAttendanceStatus = reservation.attendance_status
        let newEmailNotificationStatus = reservation.email_notification_status
        let updateUserWarningCount = false

        switch (reservation.status) {
          case 'cancelled':
          case 'closed':
            // Não é necessário avaliar presença nem notificar.
            newAttendanceStatus = 'not-applicable'
            newEmailNotificationStatus = 'not-required'
            break

          default: // status = 'reserved'
            if (hasCheckIn && hasCheckOut) {
              // Ciclo completo.
              newAttendanceStatus = 'checked-out'
              newEmailNotificationStatus = 'not-required'
            } else if (hasCheckIn) {
              // Falta o check-out.
              newAttendanceStatus = 'checked-in'
              newEmailNotificationStatus = 'pending'
              updateUserWarningCount = true
            } else {
              // Não apareceu.
              newAttendanceStatus = 'absent'
              newEmailNotificationStatus = 'pending'
              updateUserWarningCount = true
            }
            break
        }

        await client.query({
          text: `
            UPDATE space_reservations
            SET attendance_status = $1,
                email_notification_status = $2,
                updated_at = NOW()
            WHERE id = $3
          `,
          values: [
            newAttendanceStatus,
            newEmailNotificationStatus,
            reservation.id,
          ],
        })

        const penalizedUsers: Array<{
          id: string
          name: string
          email: string
          warning_count: number
        }> = []

        if (updateUserWarningCount) {
          // O dono da reserva e os colaboradores BBZ associados a ela.
          const usersToUpdate: string[] = [reservation.user_id]

          if (reservation.bbz_collaborators) {
            try {
              const collaboratorEmails = JSON.parse(
                reservation.bbz_collaborators,
              )

              if (
                Array.isArray(collaboratorEmails) &&
                collaboratorEmails.length > 0
              ) {
                const collaboratorsResult = await client.query({
                  text: `
                    SELECT id
                    FROM users
                    WHERE email = ANY($1::text[])
                  `,
                  values: [collaboratorEmails],
                })

                collaboratorsResult.rows.forEach((row: { id: string }) => {
                  if (!usersToUpdate.includes(row.id)) {
                    usersToUpdate.push(row.id)
                  }
                })
              }
            } catch (parseError) {
              ctx.log.error(
                `❌ Erro ao processar colaboradores BBZ para advertência: ${parseError}`,
              )
            }
          }

          for (const userId of usersToUpdate) {
            const updateResult = await client.query({
              text: `
                UPDATE users
                SET warning_count = warning_count + 1,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, warning_count, name, email
              `,
              values: [userId],
            })

            if (updateResult.rows?.[0]) {
              penalizedUsers.push(updateResult.rows[0])
            }
          }
        }

        return { newAttendanceStatus, penalizedUsers }
      })

      // Estatística só depois do commit: o que rolou para trás não conta.
      switch (resultado.newAttendanceStatus) {
        case 'not-applicable':
          stats.notApplicable++
          break
        case 'checked-out':
          stats.checkedOut++
          break
        case 'checked-in':
          stats.checkedIn++
          break
        case 'absent':
          stats.absent++
          break
      }

      stats.warnedUsers += resultado.penalizedUsers.length

      resultado.penalizedUsers.forEach((user) => {
        ctx.log.info(
          `  → Usuário: ${user.name || 'Sem nome'} (${user.email || user.id}) - Advertências: ${user.warning_count}`,
        )
      })

      ctx.log.info(
        `✅ Reserva ${reservation.id} atualizada: ${reservation.attendance_status} → ${resultado.newAttendanceStatus}`,
      )
    } catch (error) {
      // Uma reserva problemática não derruba o lote; ela entra em `failed` e
      // continua `pending`, então a próxima execução tenta de novo.
      stats.failed++
      ctx.log.error(
        { err: error },
        `❌ Erro ao processar reserva ${reservation.id}`,
      )
    }
  }

  ctx.log.info(
    `🔍 Verificando usuários que atingiram o limite de ${WARNING_COUNT_LIMIT} advertências...`,
  )

  const usersToBlockResult = await database.query({
    text: `
      UPDATE users
      SET account_status = false,
          updated_at = NOW()
      WHERE warning_count >= $1
      AND account_status = true
      RETURNING id, name, email, warning_count
    `,
    values: [WARNING_COUNT_LIMIT],
  })

  const bannedUsers = usersToBlockResult.rows
  stats.banned = bannedUsers.length

  if (bannedUsers.length > 0) {
    ctx.log.warn(
      `🔒 ${bannedUsers.length} usuários foram banidos por atingirem ${WARNING_COUNT_LIMIT} ou mais advertências`,
    )

    bannedUsers.forEach(
      (user: {
        name: string
        email: string
        id: string
        warning_count: number
      }) => {
        ctx.log.warn(
          `  → USUÁRIO BANIDO: ${user.name || 'Sem nome'} (${user.email || user.id}) - Advertências: ${user.warning_count}`,
        )
      },
    )
  }

  return { status: 'succeeded', stats }
}

// Teto de envios por execução e taxa de envio.
const MAX_EMAILS_PER_RUN = 60
const EMAILS_PER_SECOND = 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Converte um tstzrange do Postgres em "dd/MM/yyyy HH:mm até dd/MM/yyyy HH:mm".
 *
 * @param slotRange - string como '["2025-08-06 13:00:00+00","2025-08-06 14:00:00+00")'
 * @param timeZone - fuso IANA, São Paulo por padrão
 */
function formatSlotRange(
  slotRange: string,
  timeZone = 'America/Sao_Paulo',
): string {
  const rangeMatch = slotRange.match(/\["([^"]+)","([^"]+)"\)/)
  if (!rangeMatch) {
    throw new Error(`Invalid slot range: ${slotRange}`)
  }

  const [, startStr, endStr] = rangeMatch

  // As datas vêm do banco em UTC; converter antes de formatar.
  const startZonedTime = toZonedTime(parseISO(startStr), timeZone)
  const endZonedTime = toZonedTime(parseISO(endStr), timeZone)

  const formattedStart = formatTz(startZonedTime, 'dd/MM/yyyy HH:mm', {
    timeZone,
    locale: ptBR,
  })
  const formattedEnd = formatTz(endZonedTime, 'dd/MM/yyyy HH:mm', {
    timeZone,
    locale: ptBR,
  })

  return `${formattedStart} até ${formattedEnd}`
}

/**
 * Envia as notificações de advertência pendentes.
 *
 * Agendado às 06:10 UTC (03:10 em São Paulo), dez minutos depois do job de
 * presença — mas sem depender dele: a seleção é por estado
 * (`email_notification_status in ('pending','error')`), não por ordem.
 *
 * É retomável. Ao estourar o orçamento de tempo, para na fronteira de um envio
 * e devolve `partial` com quantos sobraram; o reconciliador redispara.
 */
export async function runEmailNotificationCollector(
  ctx: JobContext,
): Promise<JobResult> {
  ctx.log.info(
    `📧 Configuração de taxa: até ${MAX_EMAILS_PER_RUN} e-mails por execução, ${EMAILS_PER_SECOND} por segundo`,
  )

  const pendingNotificationsResult = await database.query({
    text: `
      SELECT
        r.id as reservation_id,
        r.user_id,
        r.space_id,
        r.slot_range,
        r.attendance_status,
        r.bbz_collaborators,
        u.email as user_email,
        u.name as user_name,
        u.warning_count,
        s.name as space_name,
        s.type as space_type,
        s.floor,
        s.zone,
        s.position
      FROM space_reservations r
      JOIN users u ON r.user_id = u.id
      JOIN spaces s ON r.space_id = s.id
      WHERE r.email_notification_status IN ('pending', 'error')
      ORDER BY r.updated_at ASC
      LIMIT $1
    `,
    values: [MAX_EMAILS_PER_RUN],
  })

  const pendingNotifications = pendingNotificationsResult.rows

  ctx.log.info(
    `📧 ${pendingNotifications.length} notificações pendentes ou com erro anterior neste lote`,
  )

  const stats = {
    batch: pendingNotifications.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
  }

  let interrompidoPorPrazo = false

  for (const [index, notification] of pendingNotifications.entries()) {
    if (ctx.isPastDeadline()) {
      interrompidoPorPrazo = true
      ctx.log.warn(
        `⏱️ Orçamento de tempo esgotado depois de ${index} envios; o restante fica para a próxima execução`,
      )
      break
    }

    try {
      if (index > 0) {
        await sleep(Math.floor(1000 / EMAILS_PER_SECOND))
      }

      // Reserva a linha ANTES de enviar. Sem isso, morrer entre o envio e a
      // marcação faz a próxima execução reenviar o mesmo e-mail.
      const claim = await database.query({
        text: `
          UPDATE space_reservations
          SET email_notification_status = 'sending',
              updated_at = NOW()
          WHERE id = $1
          AND email_notification_status IN ('pending', 'error')
          RETURNING id
        `,
        values: [notification.reservation_id],
      })

      if (!claim.rowCount) {
        // Outra execução pegou esta linha primeiro.
        stats.skipped++
        continue
      }

      // 1. DESTINATÁRIOS: dono da reserva em TO, colaboradores BBZ em CC.
      const emailRecipients: string[] = [notification.user_email]

      if (notification.bbz_collaborators) {
        try {
          const collaboratorEmailsJson = JSON.parse(
            notification.bbz_collaborators,
          )

          if (
            Array.isArray(collaboratorEmailsJson) &&
            collaboratorEmailsJson.length > 0
          ) {
            // Só e-mails que existem em `users`.
            const validCollaboratorsResult = await database.query({
              text: `
                SELECT email
                FROM users
                WHERE email = ANY($1::text[])
              `,
              values: [collaboratorEmailsJson],
            })

            validCollaboratorsResult.rows.forEach((row: { email: string }) => {
              if (!emailRecipients.includes(row.email)) {
                emailRecipients.push(row.email)
              }
            })
          }
        } catch (parseError) {
          ctx.log.error(`❌ Erro ao processar colaboradores BBZ: ${parseError}`)
        }
      }

      // 2. DADOS DO ESPAÇO
      let spaceDetails = notification.space_name

      if (notification.space_type === 'workstation') {
        const locationDetails = [
          notification.floor ? `Andar: ${notification.floor}` : null,
          notification.zone ? `Seção: ${notification.zone}` : null,
          notification.position ? `Posição: ${notification.position}` : null,
        ]
          .filter(Boolean)
          .join(', ')

        if (locationDetails) {
          spaceDetails = `${notification.space_name} (${locationDetails})`
        }
      }

      const spaceTypeFormatted =
        notification.space_type === 'room' ? 'Sala' : 'Estação de Trabalho'

      // 3. PERÍODO DA RESERVA
      const formattedDateRange = formatSlotRange(notification.slot_range)

      // 4. TEXTO POR TIPO DE ADVERTÊNCIA
      let warningTitle = ''
      let warningDescription = ''
      let warningInstructions = ''
      let warningType = ''

      if (notification.attendance_status === 'absent') {
        warningType = 'não comparecimento'
        warningTitle = 'Lembrete sobre reserva não utilizada'
        warningDescription = `Notamos que você não realizou check-in na sua reserva de ${spaceTypeFormatted.toLowerCase()}.`
        warningInstructions =
          'Para melhor gestão dos nossos espaços, pedimos que realize o check-in sempre que utilizar uma reserva.'
      } else if (notification.attendance_status === 'checked-in') {
        warningType = 'check-out pendente'
        warningTitle = 'Lembrete sobre check-out pendente'
        warningDescription = `Observamos que você realizou check-in, mas não finalizou sua reserva de ${spaceTypeFormatted.toLowerCase()} com check-out.`
        warningInstructions =
          'Para melhor gestão dos nossos espaços, pedimos que sempre finalize suas reservas com check-out.'
      }

      // 5. ENVIO
      const to = notification.user_email
      const cc = emailRecipients.filter(
        (email) => email !== notification.user_email,
      )

      try {
        await sendEmail({
          type: 'SPACE_ATTENDANCE_REMINDER',
          data: {
            spaceDetails,
            spaceTypeFormatted,
            dateRange: formattedDateRange,
            warningType,
            warningTitle,
            warningDescription,
            warningInstructions,
            warningCount: notification.warning_count,
          },
          to,
          cc: cc.length > 0 ? cc.join(', ') : undefined,
          userId: notification.user_id,
        })

        await database.query({
          text: `
            UPDATE space_reservations
            SET email_notification_status = 'sent',
                updated_at = NOW()
            WHERE id = $1
          `,
          values: [notification.reservation_id],
        })

        stats.sent++
      } catch (emailError) {
        ctx.log.error(
          { err: emailError },
          `❌ Erro ao enviar e-mail para reserva ${notification.reservation_id}`,
        )

        await database.query({
          text: `
            UPDATE space_reservations
            SET email_notification_status = 'error',
                updated_at = NOW()
            WHERE id = $1
          `,
          values: [notification.reservation_id],
        })

        stats.failed++
      }
    } catch (error) {
      ctx.log.error(
        { err: error },
        `❌ Erro ao processar notificação da reserva ${notification.reservation_id}`,
      )

      // Devolve a linha para `error`, de onde ela volta a ser elegível.
      await database
        .query({
          text: `
            UPDATE space_reservations
            SET email_notification_status = 'error',
                updated_at = NOW()
            WHERE id = $1
            AND email_notification_status = 'sending'
          `,
          values: [notification.reservation_id],
        })
        .catch(() => {
          // Se nem isso funcionar, a linha fica em `sending` e aparece no
          // digest depois de 24 horas, para decisão humana.
        })

      stats.failed++
    }
  }

  const restantesResult = await database.query({
    text: `
      SELECT count(*)::int AS restantes
      FROM space_reservations
      WHERE email_notification_status IN ('pending', 'error')
    `,
  })

  stats.remaining = restantesResult.rows[0]?.restantes ?? 0

  if (interrompidoPorPrazo || stats.remaining > 0) {
    ctx.log.info(
      `📧 Execução parcial: ${stats.sent} enviados, ${stats.remaining} na fila`,
    )
    return { status: 'partial', stats }
  }

  return { status: 'succeeded', stats }
}
