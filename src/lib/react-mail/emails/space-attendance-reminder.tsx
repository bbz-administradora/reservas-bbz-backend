// src/lib/react-mail/emails/space-attendance-reminder.tsx

import { Heading, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface SpaceAttendanceReminderProps {
  spaceDetails: string
  spaceTypeFormatted: string
  dateRange: string
  warningType: string
  warningTitle: string
  warningDescription: string
  warningInstructions: string
  warningCount: number
}

SpaceAttendanceReminder.PreviewProps = {
  spaceDetails: 'Workstation A1 - Escritório Principal',
  spaceTypeFormatted: 'Workstation',
  dateRange: '27/01/2026 das 09:00 às 18:00',
  warningType: 'no_check_in',
  warningTitle: '⚠️ Lembrete de Check-in',
  warningDescription: 'Você ainda não realizou o check-in da sua reserva.',
  warningInstructions: 'Por favor, realize o check-in o mais rápido possível.',
  warningCount: 1,
} satisfies SpaceAttendanceReminderProps

export default function SpaceAttendanceReminder({
  spaceDetails,
  spaceTypeFormatted,
  dateRange,
  warningTitle,
  warningDescription,
  warningInstructions,
}: SpaceAttendanceReminderProps) {
  const previewText = `Lembrete importante sobre sua reserva de ${spaceTypeFormatted.toLowerCase()}`

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          {warningTitle}
        </Heading>

        <Text className="text-[14px] text-foreground">Olá! Tudo bem?</Text>

        <Text className="text-[14px] text-foreground">
          {warningDescription}
        </Text>

        <Text className="text-[14px] text-foreground">
          <strong>Espaço:</strong> {spaceDetails}
          <br />
          <strong>Período:</strong> {dateRange}
        </Text>

        <Text className="text-[14px] text-foreground">
          {warningInstructions}
        </Text>

        <Section className="my-[32px] rounded border border-muted-foreground/20 bg-muted/20 p-4">
          <Text className="text-[14px] font-medium text-foreground">
            ℹ️ Como funciona o sistema de check-in/check-out:
          </Text>
          <Text className="text-[14px] text-foreground">
            • O <strong>check-in</strong> pode ser realizado por qualquer
            funcionário da BBZ relacionado à reserva (criador ou colaboradores
            convidados).
          </Text>
          <Text className="text-[14px] text-foreground">
            • O <strong>check-out</strong> também pode ser feito por qualquer
            funcionário da BBZ relacionado à reserva.
          </Text>
          <Text className="text-[14px] text-foreground">
            • Quando o check-out é realizado, o espaço é liberado imediatamente
            para novas reservas.
          </Text>
          <Text className="text-[14px] text-foreground">
            • Convidados externos não podem realizar check-in ou check-out.
          </Text>
        </Section>

        <Text className="text-[14px] text-foreground">
          Contamos com sua colaboração para manter nosso sistema de reservas
          funcionando corretamente. Isso ajuda a garantir que todos tenham
          acesso aos espaços de forma eficiente e organizada.
        </Text>

        <Text className="mt-10 text-[14px] text-foreground">
          Agradecemos sua atenção,
        </Text>
        <Text className="mt-0 text-[14px] font-bold text-primary">
          Equipe BBZ Gestão de Reservas
        </Text>
      </Section>
    </LayoutEmail>
  )
}

export function SpaceAttendanceReminderText({
  spaceDetails,
  spaceTypeFormatted,
  dateRange,
  warningTitle,
  warningDescription,
  warningInstructions,
}: SpaceAttendanceReminderProps): string {
  const previewText = `Lembrete importante sobre sua reserva de ${spaceTypeFormatted.toLowerCase()}`

  return `
${previewText}

${warningTitle}

Olá! Tudo bem?

${warningDescription}

Espaço: ${spaceDetails}
Período: ${dateRange}

${warningInstructions}

COMO FUNCIONA O SISTEMA DE CHECK-IN/CHECK-OUT:

• O check-in pode ser realizado por qualquer funcionário da BBZ relacionado à reserva (criador ou colaboradores convidados).
• O check-out também pode ser feito por qualquer funcionário da BBZ relacionado à reserva.
• Quando o check-out é realizado, o espaço é liberado imediatamente para novas reservas.
• Convidados externos não podem realizar check-in ou check-out.

Contamos com sua colaboração para manter nosso sistema de reservas funcionando corretamente.
Isso ajuda a garantir que todos tenham acesso aos espaços de forma eficiente e organizada.

Agradecemos sua atenção,
Equipe BBZ Gestão de Reservas
`
}

export const SpaceAttendanceReminderTemplate = {
  subject: 'Lembrete sobre sua reserva no BBZ Gestão',
  render: async (data: SpaceAttendanceReminderProps) => ({
    html: await renderEmailComponent(SpaceAttendanceReminder(data)),
    text: SpaceAttendanceReminderText(data),
  }),
}
