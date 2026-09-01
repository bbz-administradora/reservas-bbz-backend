// src/lib/react-mail/emails/weekly-compliance-reminder.tsx

import { Heading, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface WeeklyComplianceReminderProps {
  nextWeekStart: string // Ex: "27/01/2026"
  nextWeekEnd: string // Ex: "31/01/2026"
  deadlineDay: string // Ex: "quinta-feira"
}

WeeklyComplianceReminder.PreviewProps = {
  nextWeekStart: '27/01/2026',
  nextWeekEnd: '31/01/2026',
  deadlineDay: 'quinta-feira',
} satisfies WeeklyComplianceReminderProps

export default function WeeklyComplianceReminder({
  nextWeekStart,
  nextWeekEnd,
  deadlineDay,
}: WeeklyComplianceReminderProps) {
  const previewText = `⏰ Último dia para agendar sua semana! Reserve seu workstation até hoje (${deadlineDay}).`

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          ⏰ Último Dia para Agendar sua Semana!
        </Heading>

        <Text className="text-[14px] text-foreground">Olá, equipe!</Text>

        <Text className="text-[14px] text-foreground">
          Este é um lembrete importante: <strong>hoje ({deadlineDay})</strong> é
          o último dia para realizar suas reservas de workstation para a próxima
          semana.
        </Text>

        <Section className="my-[24px] rounded border border-muted-foreground/20 bg-muted/20 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            📅 Período da próxima semana:
          </Text>
          <Text className="m-0 mt-2 text-[14px] text-foreground">
            {nextWeekStart} a {nextWeekEnd}
          </Text>
        </Section>

        <Section className="my-[24px] rounded border border-amber-200 bg-amber-50 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            📋 Lembrete dos requisitos:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            • <strong>Gerentes:</strong> mínimo de 2 dias/semana
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • <strong>Subgerentes e Assistentes:</strong> mínimo de 3
            dias/semana
          </Text>
          <Text className="m-0 mt-3 text-[14px] font-bold text-red-600">
            ⚠️ Atenção: um desses dias deve ser segunda ou sexta-feira.
          </Text>
        </Section>

        <Text className="text-[14px] text-foreground">
          Caso ainda não tenha completado suas reservas, acesse a plataforma BBZ
          Gestão agora mesmo e garanta seu espaço de trabalho para a próxima
          semana.
        </Text>

        <Text className="text-[14px] text-foreground">
          Lembre-se: após o prazo de hoje, não será mais possível realizar
          reservas para a próxima semana dentro do período de compliance.
        </Text>

        <Text className="mt-10 text-[14px] text-foreground">
          Contamos com sua colaboração!
        </Text>
        <Text className="mt-0 text-[14px] font-bold text-primary">
          Equipe BBZ Gestão de Reservas
        </Text>
      </Section>
    </LayoutEmail>
  )
}

export function WeeklyComplianceReminderText({
  nextWeekStart,
  nextWeekEnd,
  deadlineDay,
}: WeeklyComplianceReminderProps): string {
  return `
⏰ Último Dia para Agendar sua Semana!

Olá, equipe!

Este é um lembrete importante: hoje (${deadlineDay}) é o último dia para realizar suas reservas de workstation para a próxima semana.

📅 Período da próxima semana: ${nextWeekStart} a ${nextWeekEnd}

📋 Lembrete dos requisitos:
• Gerentes: mínimo de 2 dias/semana
• Subgerentes e Assistentes: mínimo de 3 dias/semana
⚠️ Atenção: um desses dias deve ser segunda ou sexta-feira.

Caso ainda não tenha completado suas reservas, acesse a plataforma BBZ Gestão agora mesmo e garanta seu espaço de trabalho para a próxima semana.

Lembre-se: após o prazo de hoje, não será mais possível realizar reservas para a próxima semana dentro do período de compliance.

Contamos com sua colaboração!
Equipe BBZ Gestão de Reservas
`.trim()
}

export const WeeklyComplianceReminderTemplate = {
  subject: '⏰ BBZ Gestão: Último dia para agendar sua semana!',
  render: async (data: WeeklyComplianceReminderProps) => ({
    html: await renderEmailComponent(WeeklyComplianceReminder(data)),
    text: WeeklyComplianceReminderText(data),
  }),
}
