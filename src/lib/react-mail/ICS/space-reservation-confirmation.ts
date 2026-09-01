import { format } from 'date-fns'

interface GenerateICSSpaceReservationProps {
  userEmail: string
  userName?: string
  spaceName: string
  schedules: { date: string; startTime: string; endTime: string }[]
}

export function generateICSSpaceReservation({
  userEmail,
  userName,
  spaceName,
  schedules,
}: GenerateICSSpaceReservationProps): string {
  // Extrair o primeiro nome e capitalizar a primeira letra
  function formatUserName(name?: string): string {
    if (!name) return ''
    const firstName = name.split(' ')[0]
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  }

  const formattedUserName = formatUserName(userName)

  // Gerar eventos ICS para cada horário
  // Agora usamos diretamente os schedules sem consolidação,
  // pois o agrupamento já foi feito no caso de uso
  let eventIndex = 0
  const eventBlocks = schedules
    .map((schedule) => {
      const [day, month, year] = schedule.date.split('/')
      const dateIso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const startLocal = `${dateIso}T${schedule.startTime}:00`
      const endLocal = `${dateIso}T${schedule.endTime}:00`

      // Datas já estão no formato correto, não precisamos converter novamente
      const startDate = new Date(startLocal)
      const endDate = new Date(endLocal)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return ''
      }

      // Formatamos diretamente sem conversões adicionais
      const start = format(startDate, "yyyyMMdd'T'HHmmss")
      const end = format(endDate, "yyyyMMdd'T'HHmmss")

      const currentIndex = eventIndex++

      return `
BEGIN:VEVENT
UID:${currentIndex}-${userEmail}-@bbz.com.br
DTSTAMP:${start}Z
DTSTART;TZID=America/Sao_Paulo:${start}
DTEND;TZID=America/Sao_Paulo:${end}
SUMMARY:Reserva de Espaço - ${spaceName}${formattedUserName ? ` (${formattedUserName})` : ''}
DESCRIPTION:Reserva confirmada via sistema BBZ${formattedUserName ? `\\nAnfitrião: ${formattedUserName}` : ''}\\nData: ${schedule.date}\\nHorário: ${schedule.startTime} às ${schedule.endTime}
LOCATION:BBZ - ${spaceName}
ORGANIZER;CN=${formattedUserName || userEmail}:mailto:${userEmail}
END:VEVENT`
    })
    .filter(Boolean)
    .join('\n')

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BBZ//Space Reservation//PT
CALSCALE:GREGORIAN
${eventBlocks}
END:VCALENDAR`
}
