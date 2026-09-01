// src/lib/react-mail/emails/supervisor-reservation-cancelled.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Hr, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface SupervisorReservationCancelledProps {
  supervisorName: string
  employeeName: string
  employeePosition: string
  reservationDate: string // Ex: "28/01/2026"
  reservationDay: string // Ex: "terça-feira"
  cancelledAt: string // Ex: "23/01/2026 às 14:35"
  workstationName: string // Ex: "Workstation 12 - Bloco A"
  planningDeadline: string // Ex: "22/01/2026 (quinta-feira)"
}

const positionLabels: Record<string, string> = {
  director: 'Diretor',
  supervisor: 'Supervisor',
  manager: 'Gerente',
  assistant_manager: 'Subgerente',
  assistant: 'Assistente',
}

SupervisorReservationCancelled.PreviewProps = {
  supervisorName: 'Carlos Oliveira',
  employeeName: 'João Silva',
  employeePosition: 'assistant',
  reservationDate: '28/01/2026',
  reservationDay: 'terça-feira',
  cancelledAt: '23/01/2026 às 14:35',
  workstationName: 'Workstation 12 - Bloco A',
  planningDeadline: '22/01/2026 (quinta-feira)',
} satisfies SupervisorReservationCancelledProps

export default function SupervisorReservationCancelled({
  supervisorName,
  employeeName,
  employeePosition,
  reservationDate,
  reservationDay,
  cancelledAt,
  workstationName,
  planningDeadline,
}: SupervisorReservationCancelledProps) {
  const previewText = `⚠️ Reserva cancelada: ${capitalizeEachWord(employeeName)} encerrou reserva do dia ${reservationDate} após o prazo`

  const positionLabel = positionLabels[employeePosition] || employeePosition

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          ⚠️ Reserva Cancelada Após o Prazo
        </Heading>

        <Text className="text-[14px] text-foreground">
          Olá, {capitalizeEachWord(supervisorName.split(' ')[0])}!
        </Text>

        <Text className="text-[14px] text-foreground">
          Um membro da sua equipe encerrou uma reserva de workstation{' '}
          <strong>após o prazo de planejamento</strong>. Seguem os detalhes:
        </Text>

        {/* Dados do Colaborador */}
        <Section className="my-[24px] rounded border border-amber-200 bg-amber-50 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            👤 Colaborador:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            • Nome: <strong>{capitalizeEachWord(employeeName)}</strong>
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Cargo: <strong>{positionLabel}</strong>
          </Text>
        </Section>

        {/* Dados da Reserva Cancelada */}
        <Section className="my-[24px] rounded border border-red-200 bg-red-50 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            📅 Reserva Cancelada:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            • Data: <strong>{reservationDate}</strong> ({reservationDay})
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Workstation: <strong>{workstationName}</strong>
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Cancelado em: <strong>{cancelledAt}</strong>
          </Text>
        </Section>

        {/* Informação sobre o prazo */}
        <Section className="my-[24px] rounded border border-muted-foreground/20 bg-muted/20 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            ⏰ Prazo de Planejamento:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            O prazo para planejar reservas dessa semana era até{' '}
            <strong>{planningDeadline}</strong>.
          </Text>
          <Text className="m-0 ml-4 mt-1 text-[14px] text-foreground">
            O cancelamento foi realizado <strong>após esse prazo</strong>, por
            isso você está sendo notificado.
          </Text>
        </Section>

        <Hr className="my-[24px] border-muted-foreground/20" />

        <Text className="text-[14px] text-foreground">
          Caso necessário, entre em contato com o colaborador para entender o
          motivo do cancelamento.
        </Text>

        <Text className="text-[14px] text-foreground">
          Você pode visualizar todos os cancelamentos da sua equipe em:{' '}
          <strong>Espaços → Compliance → Cancelamentos</strong>
        </Text>

        <Text className="mt-10 text-[14px] text-foreground">
          Atenciosamente,
        </Text>
        <Text className="mt-0 text-[14px] font-bold text-primary">
          Equipe BBZ Gestão de Reservas
        </Text>
      </Section>
    </LayoutEmail>
  )
}

export function SupervisorReservationCancelledText({
  supervisorName,
  employeeName,
  employeePosition,
  reservationDate,
  reservationDay,
  cancelledAt,
  workstationName,
  planningDeadline,
}: SupervisorReservationCancelledProps): string {
  const positionLabel = positionLabels[employeePosition] || employeePosition

  return `
⚠️ Reserva Cancelada Após o Prazo

Olá, ${capitalizeEachWord(supervisorName.split(' ')[0])}!

Um membro da sua equipe encerrou uma reserva de workstation após o prazo de planejamento. Seguem os detalhes:

👤 Colaborador:
• Nome: ${capitalizeEachWord(employeeName)}
• Cargo: ${positionLabel}

📅 Reserva Cancelada:
• Data: ${reservationDate} (${reservationDay})
• Workstation: ${workstationName}
• Cancelado em: ${cancelledAt}

⏰ Prazo de Planejamento:
O prazo para planejar reservas dessa semana era até ${planningDeadline}.
O cancelamento foi realizado após esse prazo, por isso você está sendo notificado.

--------------------

Caso necessário, entre em contato com o colaborador para entender o motivo do cancelamento.

Você pode visualizar todos os cancelamentos da sua equipe em: Espaços → Compliance → Cancelamentos

Atenciosamente,
Equipe BBZ Gestão de Reservas
`.trim()
}

export const SupervisorReservationCancelledTemplate = {
  subject: '⚠️ BBZ Gestão: Reserva cancelada após o prazo',
  render: async (data: SupervisorReservationCancelledProps) => ({
    html: await renderEmailComponent(SupervisorReservationCancelled(data)),
    text: SupervisorReservationCancelledText(data),
  }),
}
