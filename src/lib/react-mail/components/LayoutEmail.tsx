// src/lib/react-mail/components/LayoutEmail.tsx

import { env } from '@/infra/env'
import { colors } from '@/lib/tailwind/styles/theme/tokens'
import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Tailwind,
} from '@react-email/components'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { FooterEmail } from './FooterEmail'
import { HeaderEmail } from './HeaderEmail'

interface LayoutEmailProps {
  children: React.ReactNode
  previewText: string
}

export function LayoutEmail({ children, previewText }: LayoutEmailProps) {
  const cssPathDev = '../../../lib/tailwind/styles/tailwind-email.generated.css'
  const cssPathProd = '/lib/tailwind/styles/tailwind-email.generated.css'
  const cssPath = path.join(
    __dirname,
    env.NODE_ENV !== 'production' ? cssPathDev : cssPathProd,
  )
  const styles = fs.readFileSync(cssPath, 'utf8')

  return (
    <Html lang="pt-br">
      <Head>
        <Font
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <style>{styles}</style>
      </Head>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors,
              fontFamily: {
                sans: [
                  '-apple-system',
                  'BlinkMacSystemFont',
                  'Segoe UI',
                  'Roboto',
                  'Oxygen',
                  'Ubuntu',
                  'Cantarell',
                  'Fira Sans',
                  'Droid Sans',
                  'Helvetica Neue',
                  'sans-serif',
                ],
              },
            },
          },
        }}
      >
        <Body
          className="mx-auto my-0 bg-background font-sans"
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
          }}
        >
          <Preview>{previewText}</Preview>
          <Container className="mx-auto w-full max-w-[600px] rounded border border-solid border-border">
            <HeaderEmail />
            {children}
            <FooterEmail />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
