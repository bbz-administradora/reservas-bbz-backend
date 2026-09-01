// src/lib/react-mail/emails/director-compliance-alert.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Hr, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

interface TeamMember {
  userName: string
  position: string
  requiredDays: number
  reservedDays: number
  missingDays: number
}

interface SupervisorSummary {
  supervisorName: string
  totalMembers: number
  compliantCount: number
  nonCompliantCount: number
  nonCompliantMembers: TeamMember[]
}

export interface DirectorComplianceAlertProps {
  directorName: string
  nextWeekStart: string // Ex: "27/01/2026"
  nextWeekEnd: string // Ex: "31/01/2026"
  totalMembers: number
  compliantCount: number
  nonCompliantCount: number
  supervisorsSummary: SupervisorSummary[]
}

const positionLabels: Record<string, string> = {
  director: 'Diretor',
  supervisor: 'Supervisor',
  manager: 'Gerente',
  assistant_manager: 'Subgerente',
  assistant: 'Assistente',
}

DirectorComplianceAlert.PreviewProps = {
  directorName: 'Ana Diretor',
  nextWeekStart: '27/01/2026',
  nextWeekEnd: '31/01/2026',
  totalMembers: 12,
  compliantCount: 7,
  nonCompliantCount: 5,
  supervisorsSummary: [
    {
      supervisorName: 'Carlos Oliveira',
      totalMembers: 5,
      compliantCount: 2,
      nonCompliantCount: 3,
      nonCompliantMembers: [
        {
          userName: 'João Silva',
          position: 'manager',
          requiredDays: 2,
          reservedDays: 1,
          missingDays: 1,
        },
        {
          userName: 'Maria Santos',
          position: 'assistant',
          requiredDays: 3,
          reservedDays: 0,
          missingDays: 3,
        },
        {
          userName: 'Pedro Almeida',
          position: 'assistant_manager',
          requiredDays: 2,
          reservedDays: 1,
          missingDays: 1,
        },
      ],
    },
    {
      supervisorName: 'Fernanda Costa',
      totalMembers: 7,
      compliantCount: 5,
      nonCompliantCount: 2,
      nonCompliantMembers: [
        {
          userName: 'Lucas Rodrigues',
          position: 'manager',
          requiredDays: 2,
          reservedDays: 0,
          missingDays: 2,
        },
        {
          userName: 'Beatriz Lima',
          position: 'assistant',
          requiredDays: 3,
          reservedDays: 2,
          missingDays: 1,
        },
      ],
    },
  ],
}

// Componente helper para renderizar membros pendentes de um supervisor
function SupervisorSection({
  supervisor,
  index,
}: {
  supervisor: SupervisorSummary
  index: number
}) {
  return (
    <Section
      key={index}
      className="my-[16px] rounded border border-muted-foreground/20 bg-muted/10 p-4"
    >
      <Text className="m-0 text-[14px] font-bold text-primary">
        📌 {capitalizeEachWord(supervisor.supervisorName)}
      </Text>
      <Text className="m-0 mt-1 text-[13px] text-foreground">
        Total: {supervisor.totalMembers} | ✅ {supervisor.compliantCount} | ❌{' '}
        {supervisor.nonCompliantCount}
      </Text>

      {supervisor.nonCompliantMembers.length > 0 && (
        <Section className="mt-3 rounded border border-red-200 bg-red-50 p-3">
          <Text className="m-0 text-[12px] font-bold text-foreground">
            Pendentes:
          </Text>
          {supervisor.nonCompliantMembers.map((member, memIndex) => (
            <Text
              key={memIndex}
              className="m-0 mt-1 text-[12px] text-foreground"
            >
              • {capitalizeEachWord(member.userName)} (
              {positionLabels[member.position] || member.position}) - falta{' '}
              {member.missingDays} dia(s)
            </Text>
          ))}
        </Section>
      )}
    </Section>
  )
}

export default function DirectorComplianceAlert({
  directorName,
  nextWeekStart,
  nextWeekEnd,
  totalMembers,
  compliantCount,
  nonCompliantCount,
  supervisorsSummary,
}: DirectorComplianceAlertProps) {
  const previewText = `📊 Relatório de Compliance: ${nonCompliantCount} colaborador(es) pendente(s) para a semana ${nextWeekStart} a ${nextWeekEnd}`

  const compliancePercentage =
    totalMembers > 0 ? Math.round((compliantCount / totalMembers) * 100) : 0

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          📊 Relatório Geral de Compliance
        </Heading>

        <Text className="text-[14px] text-foreground">
          Olá, {capitalizeEachWord(directorName.split(' ')[0])}!
        </Text>

        <Text className="text-[14px] text-foreground">
          Segue o relatório consolidado de compliance de reservas para a próxima
          semana ({nextWeekStart} a {nextWeekEnd}).
        </Text>

        {/* Resumo Geral */}
        <Section className="my-[24px] rounded border border-muted-foreground/20 bg-muted/20 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            📈 Resumo Geral:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            • Total de colaboradores: <strong>{totalMembers}</strong>
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • ✅ Em dia: <strong>{compliantCount}</strong>
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • ❌ Pendentes: <strong>{nonCompliantCount}</strong>
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Taxa de compliance: <strong>{compliancePercentage}%</strong>
          </Text>
        </Section>

        {/* Detalhamento por Supervisor */}
        {supervisorsSummary.length > 0 && (
          <>
            <Text className="text-[14px] font-bold text-foreground">
              👥 Detalhamento por Supervisor:
            </Text>

            {supervisorsSummary.map((supervisor, supIndex) => (
              <SupervisorSection
                key={supIndex}
                supervisor={supervisor}
                index={supIndex}
              />
            ))}
          </>
        )}

        <Hr className="my-[24px] border-muted-foreground/20" />

        <Text className="text-[14px] text-foreground">
          Para mais detalhes e análises completas, acesse a página de compliance
          na plataforma BBZ Gestão.
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

export function DirectorComplianceAlertText({
  directorName,
  nextWeekStart,
  nextWeekEnd,
  totalMembers,
  compliantCount,
  nonCompliantCount,
  supervisorsSummary,
}: DirectorComplianceAlertProps): string {
  const compliancePercentage =
    totalMembers > 0 ? Math.round((compliantCount / totalMembers) * 100) : 0

  const supervisorsText = supervisorsSummary
    .map((sup) => {
      const membersText = sup.nonCompliantMembers
        .map((m) => {
          const posLabel = positionLabels[m.position] || m.position
          return `    - ${capitalizeEachWord(m.userName)} (${posLabel}) - falta ${m.missingDays} dia(s)`
        })
        .join('\n')

      return `
📌 ${capitalizeEachWord(sup.supervisorName)}
   Total: ${sup.totalMembers} | ✅ ${sup.compliantCount} | ❌ ${sup.nonCompliantCount}
   Pendentes:
${membersText}`
    })
    .join('\n')

  return `
📊 Relatório Geral de Compliance

Olá, ${capitalizeEachWord(directorName.split(' ')[0])}!

Segue o relatório consolidado de compliance de reservas para a próxima semana (${nextWeekStart} a ${nextWeekEnd}).

📈 Resumo Geral:
• Total de colaboradores: ${totalMembers}
• ✅ Em dia: ${compliantCount}
• ❌ Pendentes: ${nonCompliantCount}
• Taxa de compliance: ${compliancePercentage}%

👥 Detalhamento por Supervisor:
${supervisorsText}

--------------------

Para mais detalhes e análises completas, acesse a página de compliance na plataforma BBZ Gestão.

Atenciosamente,
Equipe BBZ Gestão de Reservas
`.trim()
}

export const DirectorComplianceAlertTemplate = {
  subject: '📊 BBZ Gestão: Relatório Geral de Compliance',
  render: async (data: DirectorComplianceAlertProps) => ({
    html: await renderEmailComponent(DirectorComplianceAlert(data)),
    text: DirectorComplianceAlertText(data),
  }),
}
