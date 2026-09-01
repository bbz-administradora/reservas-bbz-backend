// src/lib/react-mail/emails/supervisor-nomination.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface SupervisorNominationProps {
  userName: string
  assignedByName: string
}

SupervisorNomination.PreviewProps = {
  userName: 'Carlos Oliveira',
  assignedByName: 'Ana Diretor',
} satisfies SupervisorNominationProps

export default function SupervisorNomination({
  userName,
  assignedByName,
}: SupervisorNominationProps) {
  const previewText = `Parabéns ${capitalizeEachWord(userName)}! Você foi nomeado(a) Supervisor(a) da equipe de atendimento BBZ. 🎉`

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          🎉 Parabéns, {capitalizeEachWord(userName)}!
        </Heading>

        <Text className="text-[14px] text-foreground">
          Você foi nomeado(a){' '}
          <strong>Supervisor(a) da Equipe de Atendimento</strong> na plataforma
          BBZ Gestão por <strong>{capitalizeEachWord(assignedByName)}</strong>.
        </Text>

        <Section className="my-[24px] rounded bg-muted/30 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            O que isso significa?
          </Text>
          <Text className="mt-2 text-[14px] text-foreground">
            Como Supervisor(a), você agora tem acesso a funcionalidades
            exclusivas para gestão da sua equipe de atendimento, incluindo:
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Adicionar e gerenciar membros da sua equipe
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Acompanhar o desempenho dos membros
          </Text>
          <Text className="m-0 ml-4 text-[14px] text-foreground">
            • Visualizar relatórios da sua equipe
          </Text>
        </Section>

        <Text className="text-[14px] text-foreground">
          Acesse a plataforma BBZ Gestão para começar a utilizar suas novas
          permissões.
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

export function SupervisorNominationText({
  userName,
  assignedByName,
}: SupervisorNominationProps): string {
  const previewText = `Parabéns ${userName}! Você foi nomeado(a) Supervisor(a) da equipe de atendimento BBZ. 🎉`

  return `
${previewText}

🎉 Parabéns, ${userName}!

Você foi nomeado(a) Supervisor(a) da Equipe de Atendimento na plataforma BBZ Gestão por ${assignedByName}.

O que isso significa?

Como Supervisor(a), você agora tem acesso a funcionalidades exclusivas para gestão da sua equipe de atendimento, incluindo:
• Adicionar e gerenciar membros da sua equipe
• Acompanhar o desempenho dos membros
• Visualizar relatórios da sua equipe

Acesse a plataforma BBZ Gestão para começar a utilizar suas novas permissões.

Este e-mail foi enviado automaticamente e não recebe respostas. Em caso de dúvidas ou suporte, utilize os canais oficiais disponíveis na plataforma BBZ Gestão.

Grande abraço,
Equipe BBZ Gestão de Reservas
`
}

export const SupervisorNominationTemplate = {
  subject: 'BBZ Gestão: Você foi nomeado(a) Supervisor(a)! 🎉',
  render: async (data: SupervisorNominationProps) => ({
    html: await renderEmailComponent(SupervisorNomination(data)),
    text: SupervisorNominationText(data),
  }),
}
