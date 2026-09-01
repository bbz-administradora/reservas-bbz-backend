// src/lib/react-mail/emails/supervisor-compliance-alert.tsx

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

export interface SupervisorComplianceAlertProps {
  supervisorName: string
  nextWeekStart: string // Ex: "27/01/2026"
  nextWeekEnd: string // Ex: "31/01/2026"
  totalMembers: number
  compliantCount: number
  nonCompliantCount: number
  nonCompliantMembers: TeamMember[]
}

const positionLabels: Record<string, string> = {
  director: 'Diretor',
  supervisor: 'Supervisor',
  manager: 'Gerente',
  assistant_manager: 'Subgerente',
  assistant: 'Assistente',
}

SupervisorComplianceAlert.PreviewProps = {
  supervisorName: 'Carlos Oliveira',
  nextWeekStart: '27/01/2026',
  nextWeekEnd: '31/01/2026',
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
}

// Componente helper para renderizar membro pendente
function MemberCard({ member, index }: { member: TeamMember; index: number }) {
  return (
    <Section
      key={index}
      className="my-[12px] rounded border border-red-200 bg-red-50 p-3"
    >
      <Text className="m-0 text-[14px] font-bold text-foreground">
        {capitalizeEachWord(member.userName)}
      </Text>
      <Text className="m-0 mt-1 text-[13px] text-foreground">
        Cargo: {positionLabels[member.position] || member.position}
      </Text>
      <Text className="m-0 text-[13px] text-foreground">
        Obrigatório: {member.requiredDays} dias | Reservado:{' '}
        {member.reservedDays} dias |{' '}
        <strong>Faltando: {member.missingDays} dia(s)</strong>
      </Text>
    </Section>
  )
}

export default function SupervisorComplianceAlert({
  supervisorName,
  nextWeekStart,
  nextWeekEnd,
  totalMembers,
  compliantCount,
  nonCompliantCount,
  nonCompliantMembers,
}: SupervisorComplianceAlertProps) {
  const previewText = `📋 Compliance da sua equipe: ${nonCompliantCount} membro(s) pendente(s) para a semana ${nextWeekStart} a ${nextWeekEnd}`

  const compliancePercentage =
    totalMembers > 0 ? Math.round((compliantCount / totalMembers) * 100) : 0

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          📋 Relatório de Compliance da Sua Equipe
        </Heading>

        <Text className="text-[14px] text-foreground">
          Olá, {capitalizeEachWord(supervisorName.split(' ')[0])}!
        </Text>

        <Text className="text-[14px] text-foreground">
          Segue o relatório de compliance de reservas da sua equipe para a
          próxima semana ({nextWeekStart} a {nextWeekEnd}).
        </Text>

        {/* Resumo */}
        <Section className="my-[24px] rounded border border-muted-foreground/20 bg-muted/20 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            📊 Resumo da Equipe:
          </Text>
          <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
            • Total de membros: <strong>{totalMembers}</strong>
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

        {/* Lista de não-compliant */}
        {nonCompliantMembers.length > 0 && (
          <>
            <Text className="text-[14px] font-bold text-foreground">
              ⚠️ Membros com pendências:
            </Text>

            {nonCompliantMembers.map((member, index) => (
              <MemberCard key={index} member={member} index={index} />
            ))}
          </>
        )}

        <Hr className="my-[24px] border-muted-foreground/20" />

        <Text className="text-[14px] text-foreground">
          Recomendamos entrar em contato com os membros pendentes para garantir
          que completem suas reservas dentro do prazo.
        </Text>

        <Text className="text-[14px] text-foreground">
          Para mais detalhes, acesse a página de compliance na plataforma BBZ
          Gestão.
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

export function SupervisorComplianceAlertText({
  supervisorName,
  nextWeekStart,
  nextWeekEnd,
  totalMembers,
  compliantCount,
  nonCompliantCount,
  nonCompliantMembers,
}: SupervisorComplianceAlertProps): string {
  const compliancePercentage =
    totalMembers > 0 ? Math.round((compliantCount / totalMembers) * 100) : 0

  const membersText = nonCompliantMembers
    .map((m) => {
      const posLabel = positionLabels[m.position] || m.position
      return `  • ${capitalizeEachWord(m.userName)} (${posLabel}) - Obrigatório: ${m.requiredDays} dias | Reservado: ${m.reservedDays} dias | Faltando: ${m.missingDays} dia(s)`
    })
    .join('\n')

  return `
📋 Relatório de Compliance da Sua Equipe

Olá, ${capitalizeEachWord(supervisorName.split(' ')[0])}!

Segue o relatório de compliance de reservas da sua equipe para a próxima semana (${nextWeekStart} a ${nextWeekEnd}).

📊 Resumo da Equipe:
• Total de membros: ${totalMembers}
• ✅ Em dia: ${compliantCount}
• ❌ Pendentes: ${nonCompliantCount}
• Taxa de compliance: ${compliancePercentage}%

⚠️ Membros com pendências:
${membersText}

--------------------

Recomendamos entrar em contato com os membros pendentes para garantir que completem suas reservas dentro do prazo.

Para mais detalhes, acesse a página de compliance na plataforma BBZ Gestão.

Atenciosamente,
Equipe BBZ Gestão de Reservas
`.trim()
}

export const SupervisorComplianceAlertTemplate = {
  subject: '📋 BBZ Gestão: Relatório de Compliance da Sua Equipe',
  render: async (data: SupervisorComplianceAlertProps) => ({
    html: await renderEmailComponent(SupervisorComplianceAlert(data)),
    text: SupervisorComplianceAlertText(data),
  }),
}
