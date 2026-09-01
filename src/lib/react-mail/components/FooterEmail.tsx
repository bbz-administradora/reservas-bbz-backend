import { env } from '@/infra/env'
import { host } from '@/infra/hosts'
import {
  Column,
  Hr,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components'

const year = new Date().getFullYear()

export function FooterEmail() {
  return (
    <>
      <Section className="px-5">
        <Text className="mt-5 text-[14px] text-muted">
          Explore as principais seções da nossa plataforma e conheça todos os
          recursos que o BBZ Gestão oferece para facilitar o agendamento e o
          controle de espaços e ambientes corporativos. Clique nos links abaixo
          para acessar nossas principais soluções e descubra como podemos apoiar
          a gestão eficiente dos seus espaços.
        </Text>

        <Section className="mt-2">
          <Row>
            <Column align="left">
              <Row className="mt-1">
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-primary"
                  href={`${host.webAdmin}/login`}
                >
                  Login
                </Link>
              </Row>
              <Row className="mt-1">
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-primary"
                  href={`${host.webAdmin}/espacos`}
                >
                  Espaços
                </Link>
              </Row>
              <Row className="mt-1">
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[14px] text-primary"
                  href={`${host.webAdmin}/espacos/minhas-reservas`}
                >
                  Minhas Reservas
                </Link>
              </Row>
            </Column>

            <Column align="left">
              <Row className="mt-1">
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[14px] text-primary"
                  href="https://bbz.com.br"
                >
                  BBZ Portal
                </Link>
              </Row>
              <Row className="mt-1">
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[14px] text-primary"
                  href="https://bbz.com.br/nossos-segmentos/"
                >
                  BBZ Segmentos
                </Link>
              </Row>
              <Row className="mt-1">
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[14px] text-primary"
                  href="https://www.bbzimoveis.com.br/"
                >
                  BBZ Imóveis
                </Link>
              </Row>
            </Column>
          </Row>
        </Section>

        <Hr className="mx-0 my-[26px] w-full border border-solid border-primary" />

        <Section>
          <Row align="center" className="w-[230px]">
            <Column align="center">
              <Link
                title="Clicar para acessar o Facebook da BBZ."
                aria-label="Clicar para acessar o Facebook da BBZ."
                target="_blank"
                rel="noopener noreferrer"
                href={env.FACEBOOK_URL}
              >
                <Img
                  src={`${env.PUBLIC_BUCKET}/email/facebook-icon-email.png`}
                  width="30"
                  height="30"
                  alt="Facebook BBZ"
                />
              </Link>
            </Column>
            <Column align="center">
              <Link
                title="Clicar para acessar o Instagram da BBZ."
                aria-label="Clicar para acessar o Instagram do BBZ."
                target="_blank"
                rel="noopener noreferrer"
                href={env.INSTAGRAM_URL}
              >
                <Img
                  src={`${env.PUBLIC_BUCKET}/email/instagram-icon-email.png`}
                  width="30"
                  height="30"
                  alt="Instagram BBZ"
                />
              </Link>
            </Column>
            <Column align="center">
              <Link
                title="Clicar para acessar o site da BBZ Gestão."
                aria-label="Clicar para acessar o site da BBZ Gestão"
                target="_blank"
                rel="noopener noreferrer"
                href={host.web}
              >
                <Img
                  src={`${env.PUBLIC_BUCKET}/email/website-icon-email.png`}
                  width="30"
                  height="30"
                  alt="Clicar para acessar o site da BBZ Gestão"
                />
              </Link>
            </Column>
            <Column align="center">
              <Link
                title={`Clicar para mandar email para ${env.EMAIL_CONTACT}`}
                aria-label={`Clicar para mandar email para ${env.EMAIL_CONTACT}`}
                target="_blank"
                rel="noopener noreferrer"
                href={`mailto: ${env.EMAIL_CONTACT}`}
              >
                <Img
                  src={`${env.PUBLIC_BUCKET}/email/mail-icon-email.png`}
                  width="30"
                  height="30"
                  alt="Clicar para mandar email para BBZ Gestão"
                />
              </Link>
            </Column>
            <Column align="center">
              <Link
                title={`Clicar para abrir o WhatsApp para ${env.WHATSAPP_CONTACT}`}
                aria-label={`Clicar para abrir o WhatsApp para ${env.WHATSAPP_CONTACT}`}
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/${env.WHATSAPP_CONTACT}`}
              >
                <Img
                  src={`${env.PUBLIC_BUCKET}/email/whatsapp-icon-email.png`}
                  width="30"
                  height="30"
                  alt="Clicar para mandar WhatsApp para BBZ Gestão"
                />
              </Link>
            </Column>
          </Row>
        </Section>

        <Text className="text-[12px] italic text-muted">
          Por favor, não responda a este e-mail, pois ele foi enviado
          automaticamente e não está configurado para receber respostas. Em caso
          de dúvidas ou necessidade de suporte, entre em contato conosco pelos
          canais oficiais disponíveis na plataforma. Agradecemos sua compreensão
          e estamos sempre à disposição para ajudar.
        </Text>
      </Section>
      <Section className="mb-0 mt-5 bg-primary py-5">
        <Section className="mx-auto max-w-md">
          <Text className="text-center text-[14px] text-primary-foreground">
            {`Copyright © ${year} BBZ Gestão | ${env.ADDRESS}`}
          </Text>
        </Section>
      </Section>
    </>
  )
}
