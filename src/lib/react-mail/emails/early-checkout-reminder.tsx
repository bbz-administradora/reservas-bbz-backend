// src/lib/react-mail/emails/early-checkout-reminder.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Hr, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

interface EarlyCheckoutOccurrence {
  userName: string
  position: string
  checkoutDate: string // Ex: "20/01/2026"
  workedHours: number // Ex: 7.5
}

export interface EarlyCheckoutReminderProps {
  supervisorName: string
  periodStart: string // Data da pendência mais antiga, Ex: "15/01/2026"
  periodEnd: string // Hoje, Ex: "22/01/2026"
  pendingCount: number
  pendingOccurrences: EarlyCheckoutOccurrence[]
}

const positionLabels: Record<string, string> = {
  director: 'Diretor',
  supervisor: 'Supervisor',
  manager: 'Gerente',
  assistant_manager: 'Subgerente',
  assistant: 'Assistente',
}

EarlyCheckoutReminder.PreviewProps = {
  supervisorName: 'Carlos Oliveira',
  periodStart: '15/01/2026',
  periodEnd: '22/01/2026',
  pendingCount: 4,
  pendingOccurrences: [
    {
      userName: 'João Silva',
      position: 'manager',
      checkoutDate: '15/01/2026',
      workedHours: 7.5,
    },
    {
      userName: 'Maria Santos',
      position: 'assistant',
      checkoutDate: '17/01/2026',
      workedHours: 6.25,
    },
    {
      userName: 'Pedro Almeida',
      position: 'assistant_manager',
      checkoutDate: '20/01/2026',
      workedHours: 8.0,
    },
    {
      userName: 'Ana Costa',
      position: 'assistant',
      checkoutDate: '21/01/2026',
      workedHours: 5.75,
    },
  ],
}

/**
 * Formata horas decimais para exibição (ex: 7.5 -> "7h30")
 */
function formatWorkedHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

// Componente helper para renderizar uma ocorrência pendente
function OccurrenceCard({
  occurrence,
  index,
}: {
  occurrence: EarlyCheckoutOccurrence
  index: number
}) {
  const minRequired = '8h45'
  const worked = formatWorkedHours(occurrence.workedHours)

  return (
    <Section
      key={index}
      className="my-[12px] rounded border border-amber-200 bg-amber-50 p-3"
    >
      <Text className="m-0 text-[14px] font-bold text-foreground">
        {capitalizeEachWord(occurrence.userName)}
      </Text>
      <Text className="m-0 mt-1 text-[13px] text-foreground">
        Cargo: {positionLabels[occurrence.position] || occurrence.position}
      </Text>
      <Text className="m-0 text-[13px] text-foreground">
        Data: {occurrence.checkoutDate} | Trabalhou: <strong>{worked}</strong>{' '}
        (mínimo: {minRequired})
      </Text>
    </Section>
  )
}

export default function EarlyCheckoutReminder({
  supervisorName,
  periodStart,
  periodEnd,
  pendingCount,
  pendingOccurrences,
}: EarlyCheckoutReminderProps) {
  const previewText = `⏰ Checkout Antecipado: ${pendingCount} ocorrência(s) pendente(s) aguardando justificativa`

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          ⏰ Lembrete: Checkouts Antecipados Pendentes
        </Heading>

        <Text className="text-[14px] text-foreground">
          Olá, {capitalizeEachWord(supervisorName.split(' ')[0])}!
        </Text>

        <Text className="text-[14px] text-foreground">
          Existem <strong>{pendingCount} ocorrência(s)</strong> de checkout
          antecipado da sua equipe aguardando justificativa no período de{' '}
          <strong>{periodStart}</strong> a <strong>{periodEnd}</strong>.
        </Text>

        {/* Informação sobre a regra */}
        <Section className="my-[24px] rounded border border-muted-foreground/20 bg-muted/20 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            📋 Regra de Jornada:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            • Jornada mínima: <strong>9 horas</strong>
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Tolerância: <strong>15 minutos</strong> (mínimo 8h45)
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Saídas antes desse tempo geram ocorrência
          </Text>
        </Section>

        {/* Lista de ocorrências pendentes */}
        {pendingOccurrences.length > 0 && (
          <>
            <Text className="text-[14px] font-bold text-foreground">
              ⚠️ Ocorrências pendentes de justificativa:
            </Text>

            {pendingOccurrences.map((occurrence, index) => (
              <OccurrenceCard
                key={index}
                occurrence={occurrence}
                index={index}
              />
            ))}
          </>
        )}

        <Hr className="my-[24px] border-muted-foreground/20" />

        <Text className="text-[14px] text-foreground">
          Por favor, acesse a plataforma BBZ Gestão para justificar ou descartar
          essas ocorrências.
        </Text>

        <Text className="text-[14px] text-foreground">
          Você pode acessar a página de ocorrências em:{' '}
          <strong>Espaços → Compliance → Ocorrências</strong>
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

export function EarlyCheckoutReminderText({
  supervisorName,
  periodStart,
  periodEnd,
  pendingCount,
  pendingOccurrences,
}: EarlyCheckoutReminderProps): string {
  const occurrencesText = pendingOccurrences
    .map((o) => {
      const posLabel = positionLabels[o.position] || o.position
      const worked = formatWorkedHours(o.workedHours)
      return `  • ${capitalizeEachWord(o.userName)} (${posLabel}) - Data: ${o.checkoutDate} | Trabalhou: ${worked} (mínimo: 8h45)`
    })
    .join('\n')

  return `
⏰ Lembrete: Checkouts Antecipados Pendentes

Olá, ${capitalizeEachWord(supervisorName.split(' ')[0])}!

Existem ${pendingCount} ocorrência(s) de checkout antecipado da sua equipe aguardando justificativa no período de ${periodStart} a ${periodEnd}.

📋 Regra de Jornada:
• Jornada mínima: 9 horas
• Tolerância: 15 minutos (mínimo 8h45)
• Saídas antes desse tempo geram ocorrência

⚠️ Ocorrências pendentes de justificativa:
${occurrencesText}

--------------------

Por favor, acesse a plataforma BBZ Gestão para justificar ou descartar essas ocorrências.

Você pode acessar a página de ocorrências em: Espaços → Compliance → Ocorrências

Atenciosamente,
Equipe BBZ Gestão de Reservas
`.trim()
}

export const EarlyCheckoutReminderTemplate = {
  subject: '⏰ BBZ Gestão: Checkouts Antecipados Pendentes',
  render: async (data: EarlyCheckoutReminderProps) => ({
    html: await renderEmailComponent(EarlyCheckoutReminder(data)),
    text: EarlyCheckoutReminderText(data),
  }),
}
