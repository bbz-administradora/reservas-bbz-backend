// src/lib/react-mail/emails/member-nomination.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface MemberNominationProps {
  userName: string
  assignedByName: string
  supervisorName: string | null
  managerName: string | null
}

MemberNomination.PreviewProps = {
  userName: 'Maria Santos',
  assignedByName: 'Carlos Oliveira',
  supervisorName: 'João Silva',
  managerName: 'Pedro Lima',
} satisfies MemberNominationProps

export default function MemberNomination({
  userName,
  assignedByName,
  supervisorName,
  managerName,
}: MemberNominationProps) {
  const previewText = `Parabéns ${capitalizeEachWord(userName)}! Você foi adicionado(a) como membro da equipe de atendimento BBZ. 🎉`

  // Monta a descrição da hierarquia
  const hierarchyDescription = buildHierarchyDescription(
    supervisorName,
    managerName,
  )

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          🎉 Parabéns, {capitalizeEachWord(userName)}!
        </Heading>

        <Text className="text-[14px] text-foreground">
          Você foi adicionado(a) como{' '}
          <strong>Membro da Equipe de Atendimento</strong> na plataforma BBZ
          Gestão por <strong>{capitalizeEachWord(assignedByName)}</strong>.
        </Text>

        {hierarchyDescription && (
          <Section className="my-[24px] rounded bg-muted/30 p-4">
            <Text className="m-0 text-[14px] font-bold text-foreground">
              Sua equipe:
            </Text>
            {managerName && (
              <Text className="m-0 ml-4 mt-2 text-[14px] text-foreground">
                • <strong>Gerente:</strong> {capitalizeEachWord(managerName)}
              </Text>
            )}
            {supervisorName && (
              <Text className="m-0 ml-4 text-[14px] text-foreground">
                • <strong>Supervisor(a):</strong>{' '}
                {capitalizeEachWord(supervisorName)}
              </Text>
            )}
          </Section>
        )}

        <Section className="my-[24px] rounded bg-muted/30 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            O que isso significa?
          </Text>
          <Text className="mt-2 text-[14px] text-foreground">
            Como membro da equipe de atendimento, você faz parte de um time
            dedicado a oferecer a melhor experiência aos usuários da plataforma
            BBZ Gestão.
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Você fará parte das atividades e rotinas da equipe
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Seu supervisor poderá acompanhar suas atividades
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Você terá acesso aos recursos disponíveis para a equipe
          </Text>
        </Section>

        <Text className="text-[14px] text-foreground">
          Acesse a plataforma BBZ Gestão para começar a utilizar os recursos
          disponíveis para a equipe.
        </Text>

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

function buildHierarchyDescription(
  supervisorName: string | null,
  managerName: string | null,
): string | null {
  if (!supervisorName && !managerName) {
    return null
  }

  const parts: string[] = []

  if (managerName) {
    parts.push(`Gerente: ${managerName}`)
  }

  if (supervisorName) {
    parts.push(`Supervisor(a): ${supervisorName}`)
  }

  return parts.join(' | ')
}

export function MemberNominationText({
  userName,
  assignedByName,
  supervisorName,
  managerName,
}: MemberNominationProps): string {
  const previewText = `Parabéns ${userName}! Você foi adicionado(a) como membro da equipe de atendimento BBZ. 🎉`

  const hierarchyLines: string[] = []
  if (managerName) {
    hierarchyLines.push(`• Gerente: ${managerName}`)
  }
  if (supervisorName) {
    hierarchyLines.push(`• Supervisor(a): ${supervisorName}`)
  }

  const hierarchySection =
    hierarchyLines.length > 0
      ? `
Sua equipe:
${hierarchyLines.join('\n')}
`
      : ''

  return `
${previewText}

🎉 Parabéns, ${userName}!

Você foi adicionado(a) como Membro da Equipe de Atendimento na plataforma BBZ Gestão por ${assignedByName}.
${hierarchySection}
O que isso significa?

Como membro da equipe de atendimento, você faz parte de um time dedicado a oferecer a melhor experiência aos usuários da plataforma BBZ Gestão.
• Você fará parte das atividades e rotinas da equipe
• Seu supervisor poderá acompanhar suas atividades
• Você terá acesso aos recursos disponíveis para a equipe

Acesse a plataforma BBZ Gestão para começar a utilizar os recursos disponíveis para a equipe.

Este e-mail foi enviado automaticamente e não recebe respostas. Em caso de dúvidas ou suporte, utilize os canais oficiais disponíveis na plataforma BBZ Gestão.

Grande abraço,
Equipe BBZ Gestão de Reservas
`
}

export const MemberNominationTemplate = {
  subject: 'BBZ Gestão: Você foi adicionado(a) à equipe de atendimento! 🎉',
  render: async (data: MemberNominationProps) => ({
    html: await renderEmailComponent(MemberNomination(data)),
    text: MemberNominationText(data),
  }),
}
