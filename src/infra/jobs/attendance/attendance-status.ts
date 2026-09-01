import { sendEmail } from '@/utils/email'
import { endOfDay, format, parseISO, subDays } from 'date-fns'
import { format as formatTz, toZonedTime } from 'date-fns-tz'
import { ptBR } from 'date-fns/locale'
import { FastifyInstance } from 'fastify'
import { AsyncTask, CronJob } from 'toad-scheduler'
import { database } from '../../database'

// Limite de advertências que resulta em banimento automático
const WARNING_COUNT_LIMIT = 5

/**
 * Task para atualizar status de presença e notificação por e-mail das reservas (uma vez por dia)
 */
function createAttendanceStatusTask(app: FastifyInstance) {
  return new AsyncTask(
    'attendance-status-updater',
    async () => {
      try {
        // Log detalhado da execução
        const execTime = new Date()

        console.log(
          `🏁 Job de atualização de status de presença iniciado às ${execTime.toLocaleTimeString('pt-BR')}`,
        )

        // Calcula o final do dia anterior (23:59:59.999 do dia anterior) usando date-fns
        const endOfYesterday = endOfDay(subDays(new Date(), 1))

        app.log.info(
          `🕒 Processando reservas até: ${format(endOfYesterday, 'dd/MM/yyyy HH:mm:ss')} (${endOfYesterday.toISOString()})`,
        )

        // Busca todas as reservas com attendance_status = 'pending' e com horário final (upper(slot_range)) anterior ao final do dia de ontem
        // Otimizado para trazer apenas os campos necessários
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

        app.log.info(
          `🔍 Encontradas ${pendingReservations.length} reservas com status de presença pendente`,
        )

        // Processar cada reserva pendente
        for (const reservation of pendingReservations) {
          try {
            // Buscar registros de check-in/check-out para esta reserva (apenas o tipo)
            const checkInOutsResult = await database.query({
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
            let newEmailNotificationStatus =
              reservation.email_notification_status
            let updateUserWarningCount = false

            // Aplicar regras de negócio para atualizar os status
            switch (reservation.status) {
              case 'cancelled':
              case 'closed':
                // Caso 1: Reserva cancelada ou fechada
                // Não é necessário avaliar presença ou enviar notificações
                newAttendanceStatus = 'not-applicable'
                newEmailNotificationStatus = 'not-required'
                break

              default: // status = 'reserved'
                if (hasCheckIn && hasCheckOut) {
                  // Caso 2: Usuário fez check-in E check-out
                  // Ciclo completo, tudo ok
                  newAttendanceStatus = 'checked-out'
                  newEmailNotificationStatus = 'not-required'
                } else if (hasCheckIn) {
                  // Caso 3: Usuário fez APENAS check-in
                  // Falta check-out, precisa receber advertência
                  newAttendanceStatus = 'checked-in'
                  newEmailNotificationStatus = 'pending'
                  updateUserWarningCount = true
                } else {
                  // Caso 4: Usuário NÃO fez check-in nem check-out
                  // Ausente, precisa receber advertência
                  newAttendanceStatus = 'absent'
                  newEmailNotificationStatus = 'pending'
                  updateUserWarningCount = true
                }
                break
            }

            // Atualizar o status da reserva
            await database.query({
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

            // Se necessário, incrementar o contador de advertências do usuário e dos colaboradores BBZ
            if (updateUserWarningCount) {
              // Lista de IDs de usuários a serem penalizados
              const usersToUpdate = [reservation.user_id]

              // Adicionar colaboradores BBZ à lista de penalizados
              if (reservation.bbz_collaborators) {
                try {
                  const collaboratorEmails = JSON.parse(
                    reservation.bbz_collaborators,
                  )

                  if (
                    Array.isArray(collaboratorEmails) &&
                    collaboratorEmails.length > 0
                  ) {
                    // Buscar IDs dos usuários por e-mail
                    const collaboratorsResult = await database.query({
                      text: `
                        SELECT id
                        FROM users
                        WHERE email = ANY($1::text[])
                      `,
                      values: [collaboratorEmails],
                    })

                    // Adicionar os IDs dos colaboradores à lista
                    collaboratorsResult.rows.forEach((row: { id: string }) => {
                      if (!usersToUpdate.includes(row.id)) {
                        usersToUpdate.push(row.id)
                      }
                    })
                  }
                } catch (parseError) {
                  app.log.error(
                    `❌ Erro ao processar colaboradores BBZ para advertência: ${parseError}`,
                  )
                }
              }

              // Atualizar todos os usuários da lista
              const penalizedUsers = []
              for (const userId of usersToUpdate) {
                const updateResult = await database.query({
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

              // Log detalhado de usuários penalizados
              app.log.info(
                `⚠️ Incrementado contador de advertências para ${penalizedUsers.length} usuários relacionados à reserva ${reservation.id}`,
              )

              penalizedUsers.forEach((user) => {
                app.log.info(
                  `  → Usuário: ${user.name || 'Sem nome'} (${user.email || user.id}) - Advertências: ${user.warning_count}`,
                )
              })
            }

            // Verificar quantos colaboradores BBZ estão envolvidos
            let collaboratorsCount = 0
            if (reservation.bbz_collaborators) {
              try {
                const collaborators = JSON.parse(reservation.bbz_collaborators)
                if (Array.isArray(collaborators)) {
                  collaboratorsCount = collaborators.length
                }
              } catch {
                collaboratorsCount = 0
              }
            }

            app.log.info(
              `✅ Reserva ${reservation.id} atualizada: ${reservation.attendance_status} → ${newAttendanceStatus}, email: ${reservation.email_notification_status} → ${newEmailNotificationStatus} (Colaboradores BBZ: ${collaboratorsCount})`,
            )
          } catch (error) {
            app.log.error(
              { err: error },
              `❌ Erro ao processar reserva ${reservation.id}`,
            )
          }
        }

        // No final do job, após processar todas as reservas, verificar e banir usuários que atingiram o limite de advertências
        try {
          app.log.info(
            `🔍 Verificando usuários que atingiram o limite de ${WARNING_COUNT_LIMIT} advertências para banimento automático...`,
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
          if (bannedUsers.length > 0) {
            app.log.warn(
              `🔒 ${bannedUsers.length} usuários foram banidos por atingirem ${WARNING_COUNT_LIMIT} ou mais advertências`,
            )

            // Logar detalhes de cada usuário banido
            bannedUsers.forEach(
              (user: {
                name: string
                email: string
                id: string
                warning_count: number
              }) => {
                app.log.warn(
                  `  → USUÁRIO BANIDO: ${user.name || 'Sem nome'} (${user.email || user.id}) - Advertências: ${user.warning_count}`,
                )
              },
            )
          } else {
            app.log.info(
              `✅ Nenhum usuário atingiu o limite de ${WARNING_COUNT_LIMIT} advertências`,
            )
          }
        } catch (banError) {
          app.log.error(
            { err: banError },
            '❌ Erro ao verificar usuários para banimento',
          )
        }

        console.log(`✅ Job de atualização de status de presença concluído`)
      } catch (error) {
        app.log.error(
          { err: error },
          '❌ Erro ao processar status de presença das reservas',
        )
      }
    },
    (err) => {
      app.log.error(
        { err },
        '❌ Erro na execução do job de atualização de status de presença',
      )
    },
  )
}

/**
 * Cria o job diário de atualização de status de presença
 * Executa às 03:00 da manhã (horário de São Paulo)
 */
export function createDailyAttendanceJob(app: FastifyInstance) {
  return new CronJob(
    {
      cronExpression: '0 0 3 * * *', // segundos, minutos, hora, dia do mês, mês, dia da semana (* = todo)
      timezone: 'America/Sao_Paulo',
    },
    createAttendanceStatusTask(app),
    {
      preventOverrun: true,
    },
  )
}

// Constantes para controle de taxa de envio de e-mails
const MAX_EMAILS_PER_DAY = 60 // Limite máximo de e-mails por dia
const EMAILS_PER_SECOND = 1 // Número de e-mails processados por segundo (taxa de envio)

/**
 * Task para coletar dados de notificações pendentes (roda 20 minutos após o job de atualização de status)
 *
 * Este job realiza:
 * 1. Busca todas as reservas com email_notification_status = 'pending'
 * 2. Coleta dados necessários para o envio de e-mails usando o sistema existente
 * 3. Prepara os dados formatados para geração de e-mails de notificação:
 *    - Lista de destinatários (criador da reserva + colaboradores BBZ)
 *    - Informações do espaço (nome, tipo, andar, seção)
 *    - Detalhes da reserva (data/hora de início e fim)
 *    - Textos específicos para cada tipo de advertência (attendance_status)
 *
 * Limitações de taxa:
 * - Processa no máximo MAX_EMAILS_PER_DAY notificações por execução
 * - Respeita o limite de EMAILS_PER_SECOND e-mails por segundo
 */
function createEmailNotificationTask(app: FastifyInstance) {
  return new AsyncTask(
    'email-notification-data-collector',
    async () => {
      try {
        // Log detalhado da execução
        const execTime = new Date()
        console.log(
          `📧 Job notificação de email iniciado às ${execTime.toLocaleTimeString('pt-BR')}`,
        )

        // Busca todas as reservas com email_notification_status = 'pending'
        // Obtemos todos os dados necessários para criar o conteúdo do e-mail
        console.log(
          `📧 Configuração de taxa: máximo de ${MAX_EMAILS_PER_DAY} e-mails por dia, ${EMAILS_PER_SECOND} e-mail por segundo`,
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
          values: [MAX_EMAILS_PER_DAY],
        })

        const pendingNotifications = pendingNotificationsResult.rows

        console.log(
          `📧 Encontradas ${pendingNotifications.length} notificações pendentes ou com erro anterior para processamento`,
        )

        // Função auxiliar para adicionar atraso entre envios (respeitar a taxa de envio)
        function sleep(ms: number) {
          return new Promise((resolve) => setTimeout(resolve, ms))
        }

        // Processar cada notificação (com controle de taxa de envio)
        for (const [index, notification] of pendingNotifications.entries()) {
          try {
            // Se não for o primeiro email, aguardar o tempo necessário para respeitar a taxa
            if (index > 0) {
              const delayMs = Math.floor(1000 / EMAILS_PER_SECOND) // Converter para milissegundos
              console.log(
                `⏱️ Aguardando ${delayMs}ms antes de processar a próxima notificação...`,
              )
              await sleep(delayMs)
            }
            // 1. PREPARAR LISTA DE DESTINATÁRIOS (TO) DO EMAIL

            // Iniciar com o email do criador da reserva
            const emailRecipients = [notification.user_email]

            // Adicionar emails dos colaboradores BBZ
            let bbzCollaboratorEmails: string[] = []
            if (notification.bbz_collaborators) {
              try {
                // O campo bbz_collaborators é um array JSON de emails
                const collaboratorEmailsJson = JSON.parse(
                  notification.bbz_collaborators,
                )

                if (
                  Array.isArray(collaboratorEmailsJson) &&
                  collaboratorEmailsJson.length > 0
                ) {
                  // Verificar quais emails existem na tabela users
                  const validCollaboratorsResult = await database.query({
                    text: `
                      SELECT email
                      FROM users
                      WHERE email = ANY($1::text[])
                    `,
                    values: [collaboratorEmailsJson],
                  })

                  // Mapear apenas emails válidos (que existem na tabela users)
                  bbzCollaboratorEmails = validCollaboratorsResult.rows.map(
                    (row: { email: string }) => row.email,
                  )

                  // Adicionar à lista de destinatários, evitando duplicatas
                  bbzCollaboratorEmails.forEach((email) => {
                    if (!emailRecipients.includes(email)) {
                      emailRecipients.push(email)
                    }
                  })
                }
              } catch (parseError) {
                app.log.error(
                  `❌ Erro ao processar colaboradores BBZ: ${parseError}`,
                )
              }
            }

            // 2. FORMATAR DADOS DO ESPAÇO

            // Formatação específica baseada no tipo do espaço
            let spaceDetails = notification.space_name

            // Para workstations, adicionar floor, zone e position se disponíveis
            if (notification.space_type === 'workstation') {
              const locationDetails = [
                notification.floor ? `Andar: ${notification.floor}` : null,
                notification.zone ? `Seção: ${notification.zone}` : null,
                notification.position
                  ? `Posição: ${notification.position}`
                  : null,
              ]
                .filter(Boolean)
                .join(', ')

              if (locationDetails) {
                spaceDetails = `${notification.space_name} (${locationDetails})`
              }
            }

            const spaceTypeFormatted =
              notification.space_type === 'room'
                ? 'Sala'
                : 'Estação de Trabalho'

            // 3. FORMATAR DATAS DA RESERVA

            /**
             * Formats a Postgres tstzrange string into "dd/MM/yyyy HH:mm até dd/MM/yyyy HH:mm"
             * @param slotRange - string like '["2025-08-06 13:00:00+00","2025-08-06 14:00:00+00")'
             * @param timeZone - IANA time zone, default to São Paulo
             */
            function formatSlotRange(
              slotRange: string,
              timeZone = 'America/Sao_Paulo',
            ): string {
              // Extract start/end timestamps via regex
              const rangeMatch = slotRange.match(/\["([^"]+)","([^"]+)"\)/)
              if (!rangeMatch) {
                throw new Error(`Invalid slot range: ${slotRange}`)
              }

              const [, startStr, endStr] = rangeMatch

              // As datas do banco vêm em UTC, precisamos garantir que parseISO reconheça isso
              const startDate = parseISO(startStr)
              const endDate = parseISO(endStr)

              // Primeiro convertemos as datas UTC para o fuso horário desejado usando toZonedTime
              const startZonedTime = toZonedTime(startDate, timeZone)
              const endZonedTime = toZonedTime(endDate, timeZone)

              // Depois formatamos as datas já convertidas para o fuso horário
              const formattedStart = formatTz(
                startZonedTime,
                'dd/MM/yyyy HH:mm',
                {
                  timeZone,
                  locale: ptBR,
                },
              )
              const formattedEnd = formatTz(endZonedTime, 'dd/MM/yyyy HH:mm', {
                timeZone,
                locale: ptBR,
              })

              return `${formattedStart} até ${formattedEnd}`
            }

            const formattedDateRange = formatSlotRange(notification.slot_range)

            // 4. PREPARAR TEXTOS BASEADOS NO ATTENDANCE_STATUS

            // Textos padrão para cada tipo de attendance_status
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

            // 5. CRIAR OBJETO DE NOTIFICAÇÃO FINAL

            // Separar destinatário principal (TO - criador da reserva) dos destinatários em cópia (CC - colaboradores)
            const to = notification.user_email
            const cc = emailRecipients.filter(
              (email) => email !== notification.user_email,
            )

            // 6. ENVIAR EMAIL E ATUALIZAR STATUS DA NOTIFICAÇÃO
            try {
              // Enviar o email usando o template SPACE_ATTENDANCE_REMINDER
              const emailResponse = await sendEmail({
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
                to: to,
                cc: cc.length > 0 ? cc.join(', ') : undefined, // Converter array de emails para string separada por vírgulas
                userId: notification.user_id,
              })

              // Atualizar o status da notificação para 'sent'
              await database.query({
                text: `
                  UPDATE space_reservations
                  SET email_notification_status = 'sent',
                      updated_at = NOW()
                  WHERE id = $1
                `,
                values: [notification.reservation_id],
              })
            } catch (emailError) {
              console.error(
                `❌ Erro ao enviar e-mail para reserva ${notification.reservation_id}:`,
                emailError,
              )

              // Marcar como falha no envio
              await database.query({
                text: `
                  UPDATE space_reservations
                  SET email_notification_status = 'error',
                      updated_at = NOW()
                  WHERE id = $1
                `,
                values: [notification.reservation_id],
              })
            }
          } catch (error) {
            console.error(
              `❌ Erro ao processar notificação para reserva ${notification.reservation_id}:`,
              error,
            )

            try {
              // Marcar a notificação como erro para evitar que ela seja processada repetidamente
              await database.query({
                text: `
                  UPDATE space_reservations
                  SET email_notification_status = 'error',
                      updated_at = NOW()
                  WHERE id = $1
                `,
                values: [notification.reservation_id],
              })

              console.log(
                `⚠️ Reserva ${notification.reservation_id} marcada com status 'error' devido a erro no processamento`,
              )
            } catch (updateError) {
              console.error(
                `❌ Não foi possível atualizar o status da reserva ${notification.reservation_id}:`,
                updateError,
              )
            }
          }
        }

        console.log(`✅ Job de emails concluído`)
      } catch (error) {
        console.error('❌ Erro ao processar dados para emails:', error)
      }
    },
    (err) => {
      console.error(
        '❌ Erro na execução do job de coleta de dados para emails:',
        err,
      )
    },
  )
}

/**
 * Cria o job diário de envio de notificações por email
 * Executa às 03:10 da manhã (horário de São Paulo)
 * Roda 10 minutos após o job de atualização de status de presença
 */
export function createDailyEmailNotificationJob(app: FastifyInstance) {
  return new CronJob(
    {
      cronExpression: '0 10 3 * * *', // executa às 03:10:00
      timezone: 'America/Sao_Paulo',
    },
    createEmailNotificationTask(app),
    {
      preventOverrun: true,
    },
  )
}
