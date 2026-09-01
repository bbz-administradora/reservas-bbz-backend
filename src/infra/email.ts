import nodemailer from 'nodemailer'
import { env } from './env'
import { InternalServerError } from './errors'

interface EmailData {
  to: string
  cc?: string
  bcc?: string
  text?: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: string
    encoding?: string
    contentType?: string
  }>
}

interface EmailSendResult {
  status: 'SUCCESS' | 'FAILURE'
  errorMessage?: string
  response?: nodemailer.SentMessageInfo
}

/**
 * Cria um transporter de e-mail utilizando as configurações definidas nas variáveis de ambiente.
 *
 * @returns Transporter configurado do nodemailer.
 */
export const createEmailTransporter = () => {
  const host = env.EMAIL_HOST_SMTP
  const port = Number(env.EMAIL_HOST_PORT)
  const user = env.EMAIL_HOST_USER
  const pass = env.EMAIL_HOST_PASSWORD

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for port 465, false otherwise
    auth: {
      user,
      pass,
    },
    // Configurações adicionais para melhorar performance
    connectionTimeout: 10000, // 10 segundos para conectar
    greetingTimeout: 5000, // 5 segundos para o greeting
    socketTimeout: 30000, // 30 segundos para operações no socket
    pool: true, // Usa pool de conexões (reusa conexões)
    maxConnections: 5, // Máximo de 5 conexões simultâneas
    maxMessages: 100, // Máximo de 100 mensagens por conexão
    rateDelta: 1000, // Janela de tempo para rate limiting
    rateLimit: 5, // Máximo de 5 emails por segundo
  })

  return transporter
}

/**
 * Envia um e-mail utilizando o nodemailer.
 *
 * Caso ocorra algum erro, ele é encapsulado em um InternalServerError e lançado,
 * permitindo que o globalErrorHandler o capture.
 *
 * @param {EmailData} emailData - Dados do e-mail a ser enviado.
 * @returns {Promise<EmailSendResult>} Informações sobre a mensagem enviada.
 * @throws {InternalServerError} Em caso de erro no envio do e-mail.
 */
export const sendMailWithNodemailer = async ({
  to,
  cc,
  bcc,
  text,
  subject,
  html,
  attachments,
}: EmailData): Promise<EmailSendResult> => {
  const transporter = createEmailTransporter()

  const mailOptions = {
    from: env.EMAIL_FROM,
    to,
    cc,
    bcc,
    text,
    subject,
    html,
    attachments: attachments?.map((attachment) => {
      const mapped = {
        filename: attachment.filename,
        content: attachment.content,
      } as any
      // Só adiciona encoding se explicitamente informado (não para ICS)
      if (attachment.encoding) {
        mapped.encoding = attachment.encoding
      }
      if (attachment.contentType) {
        mapped.contentType = attachment.contentType
      }
      return mapped
    }),
  }

  try {
    const info = await transporter.sendMail(mailOptions)

    return {
      status: 'SUCCESS',
      response: info,
    }
  } catch (error) {
    throw new InternalServerError({
      message: 'Erro ao enviar o e-mail.',
      action:
        'Verifique as configurações de SMTP, credenciais e a conexão com o servidor de e-mail.',
      details: error,
    })
  }
}
