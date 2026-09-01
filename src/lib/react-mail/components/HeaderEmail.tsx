// HeaderEmail.js ou HeaderEmail.tsx
import { env } from '@/infra/env'
import { host } from '@/infra/hosts'
import { Img, Link, Section } from '@react-email/components'

export function HeaderEmail() {
  return (
    <Section className="bg-accent p-[20px] text-center">
      <Link target="_blank" rel="noopener noreferrer" href={host.webAdmin}>
        <Img
          src={`${env.PUBLIC_BUCKET}/email/logo-horizontal-primary.png`}
          width="77"
          height="77"
          alt="logo BBZ"
          className="mx-auto"
        />
      </Link>
    </Section>
  )
}
