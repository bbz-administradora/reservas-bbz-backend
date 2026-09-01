// src/utils/email.ts

import { database } from '@/infra/database'
import { sendMailWithNodemailer } from '@/infra/email'
import emailTemplates, {
  EmailDataMap,
  EmailType,
} from '@/lib/react-mail/templates'

interface sendEmailProps<T extends EmailType> {
  type: T
  data: EmailDataMap[T]
  to: string
  cc?: string
  bcc?: string
  userId?: string
  attachments?: Array<{
    filename: string
    content: string
    encoding?: string
    contentType?: string
  }>
}

export async function sendEmail<T extends EmailType>({
  type,
  data,
  to,
  cc,
  bcc,
  userId,
  attachments,
}: sendEmailProps<T>) {
  // 📌 use case - required fields/type and send email
  if (!type || !to || !(type in emailTemplates)) {
    return null
  }

  const { subject, render } = emailTemplates[type as EmailType]
  const renderedContent = await render(data as any)
  const { html, text } = renderedContent

  const responseEmail = await sendMailWithNodemailer({
    to,
    cc,
    bcc,
    text,
    subject,
    html,
    attachments,
  })

  // 📌 use case - if type is not in email_types table, add it

  const typeResult = await database.query({
    text: `
      SELECT id
      FROM email_types
      WHERE type = $1
    `,
    values: [type],
  })

  let emailTypeId
  if (typeResult.rows.length === 0) {
    const insertTypeResult = await database.query({
      text: `
        INSERT INTO email_types (type)
        VALUES ($1)
        RETURNING id
      `,
      values: [type],
    })

    emailTypeId = insertTypeResult.rows[0].id
  } else {
    emailTypeId = typeResult.rows[0].id
  }

  // 📌 use case - add data in email_logs

  await database.query({
    text: `
      INSERT INTO email_logs (email_types_id, user_id, "to", cc, bcc, subject, status, response)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    values: [
      emailTypeId,
      userId || null,
      to,
      cc,
      bcc,
      subject,
      responseEmail.status,
      JSON.stringify(responseEmail),
    ],
  })

  return responseEmail
}
