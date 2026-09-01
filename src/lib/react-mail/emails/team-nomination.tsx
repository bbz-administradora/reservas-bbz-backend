// src/lib/react-mail/emails/team-nomination.tsx

import { capitalizeEachWord } from '@/utils/textUtils'
import { Heading, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface TeamNominationProps {
  userName: string
  positionLabel: string
  assignedByName: string
}

/**
 * Configurações específicas por posição
 */
const positionConfigs: Record<
  string,
  {
    emoji: string
    responsibilities: string[]
  }
> = {
  Diretor: {
    emoji: '👔',
    responsibilities: [
      'Liderar toda a equipe de atendimento',
      'Nomear e gerenciar Supervisores',
      'Definir estratégias e metas',
      'Aprovar decisões importantes',
    ],
  },
  Supervisor: {
    emoji: '📋',
    responsibilities: [
      'Supervisionar os Gerentes da sua área',
      'Nomear e gerenciar Gerentes',
      'Acompanhar métricas e desempenho',
      'Reportar ao Diretor',
    ],
  },
  Gerente: {
    emoji: '🎯',
    responsibilities: [
      'Gerenciar Subgerentes e Assistentes',
      'Nomear e coordenar sua equipe',
      'Acompanhar métricas de atendimento',
      'Reportar ao Supervisor',
    ],
  },
  Subgerente: {
    emoji: '⭐',
    responsibilities: [
      'Auxiliar o Gerente na gestão da equipe',
      'Acompanhar o trabalho dos Assistentes',
      'Substituir o Gerente quando necessário',
      'Reportar ao Gerente',
    ],
  },
  Assistente: {
    emoji: '🙌',
    responsibilities: [
      'Realizar atendimentos aos clientes',
      'Gerenciar reservas e espaços',
      'Auxiliar nas operações diárias',
      'Reportar ao Gerente ou Subgerente',
    ],
  },
}

TeamNomination.PreviewProps = {
  userName: 'João Silva',
  positionLabel: 'Gerente',
  assignedByName: 'Carlos Oliveira',
} satisfies TeamNominationProps

export default function TeamNomination({
  userName,
  positionLabel,
  assignedByName,
}: TeamNominationProps) {
  const config = positionConfigs[positionLabel] || {
    emoji: '🎉',
    responsibilities: [
      'Fazer parte da equipe de atendimento',
      'Auxiliar nas operações diárias',
    ],
  }

  const previewText = `Parabéns ${capitalizeEachWord(userName)}! Você foi nomeado(a) ${positionLabel} da equipe de atendimento BBZ. ${config.emoji}`

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          {config.emoji} Parabéns, {capitalizeEachWord(userName)}!
        </Heading>

        <Text className="text-[14px] text-foreground">
          Você foi nomeado(a) <strong>{positionLabel}</strong> da Equipe de
          Atendimento na plataforma BBZ Gestão por{' '}
          <strong>{capitalizeEachWord(assignedByName)}</strong>.
        </Text>

        <Section className="my-[24px] rounded bg-muted/30 p-4">
          <Text className="m-0 text-[14px] font-bold text-foreground">
            O que isso significa?
          </Text>
          <Text className="mt-2 text-[14px] text-foreground">
            Como {positionLabel}, você agora tem acesso a funcionalidades
            exclusivas, incluindo:
          </Text>
          {config.responsibilities.map((responsibility, index) => (
            <Text key={index} className="m-0 ml-4 text-[14px] text-foreground">
              • {responsibility}
            </Text>
          ))}
        </Section>

        <Text className="text-[14px] text-foreground">
          Acesse a plataforma para começar a utilizar suas novas permissões!
        </Text>

        <Text className="mt-[32px] text-[14px] text-foreground">
          Atenciosamente,
          <br />
          <strong>Equipe BBZ</strong>
        </Text>
      </Section>
    </LayoutEmail>
  )
}

export const TeamNominationTemplate = {
  subject: '🎉 Você foi nomeado para a Equipe de Atendimento BBZ!',
  render: async (data: TeamNominationProps) => {
    const html = await renderEmailComponent(TeamNomination(data))
    const text = `Parabéns ${data.userName}! Você foi nomeado(a) ${data.positionLabel} da Equipe de Atendimento BBZ por ${data.assignedByName}.`
    return { html, text }
  },
}
