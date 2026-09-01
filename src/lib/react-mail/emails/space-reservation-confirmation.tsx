// src/lib/react-mail/emails/space-reservation-confirmation.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Section, Text } from '@react-email/components'
import { isEqual, parse } from 'date-fns'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface SpaceReservationConfirmationProps {
  userName: string
  spaceName: string
  schedules: { date: string; startTime: string; endTime: string }[]
}

// Interface para horários agrupados após processamento
interface ConsolidatedSchedule {
  date: string
  timeRanges: { start: string; end: string }[]
}

SpaceReservationConfirmation.PreviewProps = {
  userName: 'João Silva',
  spaceName: 'Workstation A1',
  schedules: [
    { date: '27/01/2026', startTime: '09:00', endTime: '12:00' },
    { date: '27/01/2026', startTime: '14:00', endTime: '18:00' },
    { date: '28/01/2026', startTime: '09:00', endTime: '18:00' },
  ],
} satisfies SpaceReservationConfirmationProps

export default function SpaceReservationConfirmation({
  userName,
  spaceName,
  schedules,
}: SpaceReservationConfirmationProps) {
  const previewText = `Reserva do espaço ${capitalizeEachWord(spaceName)} confirmada por ${capitalizeEachWord(userName)}.`

  // Consolidar os horários consecutivos
  const consolidatedSchedules = consolidateSchedules(schedules)

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          Reserva confirmada: {capitalizeEachWord(spaceName)}
        </Heading>

        <Text className="text-[14px] text-foreground">
          O espaço <strong>{capitalizeEachWord(spaceName)}</strong> foi
          reservado com sucesso por{' '}
          <strong>{capitalizeEachWord(userName)}</strong>. Confira abaixo os
          horários agendados:
        </Text>

        {consolidatedSchedules.map((dateGroup, dateIndex) => (
          <div key={dateIndex}>
            {dateGroup.timeRanges.map((timeRange, timeIndex) => (
              <Text
                key={`${dateIndex}-${timeIndex}`}
                className="text-[14px] text-foreground"
              >
                <strong>Data:</strong> {dateGroup.date}
                <br />
                <strong>Início:</strong> {timeRange.start}
                <br />
                <strong>Término:</strong> {timeRange.end}
              </Text>
            ))}
          </div>
        ))}

        <Text className="text-[14px] text-foreground">
          Este e-mail foi enviado automaticamente e não recebe respostas. Em
          caso de dúvidas ou suporte, utilize os canais oficiais disponíveis na
          plataforma BBZ Gestão.
        </Text>

        <Text className="mt-10 text-[14px] text-foreground">
          Grande abraço,
        </Text>
        <Text className="mt-0 text-[14px] font-bold text-primary">
          Equipe BBZ Gestão de Reservas
        </Text>
      </Section>
    </LayoutEmail>
  )
}

export function SpaceReservationConfirmationText({
  userName,
  spaceName,
  schedules,
}: SpaceReservationConfirmationProps): string {
  const previewText = `Reserva do espaço ${spaceName} confirmada por ${userName}.`

  // Consolidar os horários consecutivos
  const consolidatedSchedules = consolidateSchedules(schedules)

  // Formatar agenda com horários consolidados
  const agenda = consolidatedSchedules
    .map((dateGroup) => {
      return dateGroup.timeRanges
        .map(
          (timeRange) =>
            `Data: ${dateGroup.date}\nInício: ${timeRange.start}\nTérmino: ${timeRange.end}`,
        )
        .join('\n\n')
    })
    .join('\n\n')

  return `
${previewText}

O espaço ${spaceName} foi reservado com sucesso por ${userName}.
Confira abaixo os horários agendados:

${agenda}

Este e-mail foi enviado automaticamente e não recebe respostas. Em caso de dúvidas ou suporte, utilize os canais oficiais disponíveis na plataforma BBZ Gestão.

Grande abraço,
Equipe BBZ Gestão de Reservas
`
}

export const SpaceReservationConfirmationTemplate = {
  subject: 'Reserva confirmada: espaço agendado com sucesso!',
  render: async (data: SpaceReservationConfirmationProps) => ({
    html: await renderEmailComponent(SpaceReservationConfirmation(data)),
    text: SpaceReservationConfirmationText(data),
  }),
}

// Função para consolidar horários consecutivos
function consolidateSchedules(
  schedules: SpaceReservationConfirmationProps['schedules'],
): ConsolidatedSchedule[] {
  if (!schedules.length) return []

  // Cria um mapa de datas para facilitar o agrupamento
  const dateMap: Record<string, { start: string; end: string }[]> = {}

  // Ordena os horários por data e horário de início
  const sortedSchedules = [...schedules].sort((a, b) => {
    const dateA = parse(
      `${a.date} ${a.startTime}`,
      'dd/MM/yyyy HH:mm',
      new Date(),
    )
    const dateB = parse(
      `${b.date} ${b.startTime}`,
      'dd/MM/yyyy HH:mm',
      new Date(),
    )
    return dateA.getTime() - dateB.getTime()
  })

  // Agrupa por data
  sortedSchedules.forEach((schedule) => {
    if (!dateMap[schedule.date]) {
      dateMap[schedule.date] = []
    }
    dateMap[schedule.date].push({
      start: schedule.startTime,
      end: schedule.endTime,
    })
  })

  // Para cada data, consolida os horários consecutivos
  const consolidated: ConsolidatedSchedule[] = []

  Object.keys(dateMap).forEach((date) => {
    const timeRanges = dateMap[date]
    const consolidatedTimeRanges: { start: string; end: string }[] = []

    let currentRange = { ...timeRanges[0] }

    for (let i = 1; i < timeRanges.length; i++) {
      const currentRangeEnd = parse(
        `${date} ${currentRange.end}`,
        'dd/MM/yyyy HH:mm',
        new Date(),
      )
      const nextRangeStart = parse(
        `${date} ${timeRanges[i].start}`,
        'dd/MM/yyyy HH:mm',
        new Date(),
      )

      // Verifica se os horários são consecutivos (o fim do atual é igual ao início do próximo)
      if (isEqual(currentRangeEnd, nextRangeStart)) {
        // Consolida estendendo o horário de término
        currentRange.end = timeRanges[i].end
      } else {
        // Se não for consecutivo, salva o intervalo atual e inicia um novo
        consolidatedTimeRanges.push({ ...currentRange })
        currentRange = { ...timeRanges[i] }
      }
    }

    // Adiciona o último intervalo processado
    consolidatedTimeRanges.push(currentRange)

    consolidated.push({
      date,
      timeRanges: consolidatedTimeRanges,
    })
  })

  return consolidated
}
