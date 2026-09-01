// src/lib/react-mail/emails/forgot-password.tsx

import { Button, Heading, Section, Text } from '@react-email/components'
import { renderEmailComponent } from '..'
import { LayoutEmail } from '../components/LayoutEmail'

export interface ForgotPasswordProps {
  url: string
}

ForgotPassword.PreviewProps = {
  url: 'https://bbz-gestao.com.br/reset-password?token=abc123',
} satisfies ForgotPasswordProps

export default function ForgotPassword({ url }: ForgotPasswordProps) {
  const previewText =
    'Recupere o acesso à sua conta BBZ Gestão. Redefina sua senha agora! 🔐'

  return (
    <LayoutEmail previewText={previewText}>
      <Section className="mt-[20px] px-5">
        <Heading className="mx-0 my-[32px] p-0 text-center text-[20px] font-bold text-foreground">
          Redefina sua senha do BBZ Gestão
        </Heading>

        <Text className="text-[14px] text-foreground">
          Olá, recebemos uma solicitação para redefinir sua senha na plataforma
          BBZ Gestão. Se foi você quem solicitou, clique no botão abaixo para
          criar uma nova senha:
        </Text>

        <Section className="my-[32px] text-center">
          <Button
            href={url}
            className="rounded bg-primary px-6 py-3 text-[14px] font-bold text-white"
          >
            Criar Nova Senha
          </Button>
          <Text className="mt-4 text-center text-[12px] text-foreground">
            (Este link é válido por 24 horas)
          </Text>
        </Section>

        <Text className="text-[14px] text-foreground">
          Se você não solicitou a redefinição de senha, pode ignorar este
          e-mail. Sua senha permanecerá inalterada.
        </Text>

        <Text className="text-[14px] text-foreground">
          Se o botão não funcionar, você também pode copiar e colar o link
          abaixo no seu navegador:
        </Text>

        <Text className="my-4 break-all text-[12px] text-primary">{url}</Text>

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

export function ForgotPasswordText({ url }: ForgotPasswordProps): string {
  const previewText =
    'Recupere o acesso à sua conta BBZ Gestão. Redefina sua senha agora! 🔐'

  return `
${previewText}

Redefina sua senha do BBZ Gestão

Olá, recebemos uma solicitação para redefinir sua senha na plataforma BBZ Gestão.
Se foi você quem solicitou, acesse o link abaixo para criar uma nova senha:

${url}

(Este link é válido por 24 horas)

Se você não solicitou a redefinição de senha, pode ignorar este e-mail. Sua senha permanecerá inalterada.

Este e-mail foi enviado automaticamente e não recebe respostas. Em caso de dúvidas ou suporte, utilize os canais oficiais disponíveis na plataforma BBZ Gestão.

Grande abraço,
Equipe BBZ Gestão de Reservas
`
}

export const ForgotPasswordTemplate = {
  subject: 'BBZ Gestão: Redefinição de Senha',
  render: async (data: ForgotPasswordProps) => ({
    html: await renderEmailComponent(ForgotPassword(data)),
    text: ForgotPasswordText(data),
  }),
}
