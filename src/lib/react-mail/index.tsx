// src/lib/react-mail/index.tsx

import { render } from '@react-email/components'
import React from 'react'

interface EmailProps {
  [key: string]: any
}

export async function renderEmailComponent(
  EmailComponentJSX: React.ReactElement<EmailProps>,
): Promise<string> {
  const emailHtml = await render(EmailComponentJSX, {
    pretty: false,
  })

  return emailHtml
}
