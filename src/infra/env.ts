import { config as dotenvConfig } from 'dotenv'
import { expand as dotenvExpand } from 'dotenv-expand'
import { existsSync } from 'node:fs'
import { z } from 'zod'
import { InternalServerError } from './errors'

const isProduction = process.env.NODE_ENV === 'production'
const renderSecretFile = '/etc/secrets/.env.prod'
const environmentFile = isProduction
  ? existsSync(renderSecretFile)
    ? renderSecretFile
    : '.env.prod'
  : '.env'

const environmentConfig = dotenvConfig({
  path: environmentFile,
})

// Expand variables, allows using ${VAR_NAME} in .env files
dotenvExpand(environmentConfig)

const envSchema = z.object({
  // API configuration
  DOMAIN: z.string(),
  API_URL: z.string(),
  API_PORT: z.coerce.number().default(Number(process.env.PORT ?? 3334)),
  API_DOC_USER: z.string(),
  API_DOC_PASSWORD: z.string(),
  WEB_APP_URL: z.string(),
  WEB_APP_URL_PORT: z.coerce.number().default(3000),
  WEB_ADM_APP_URL: z.string(),
  WEB_ADM_APP_URL_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  EMAIL_CONTACT: z.string().email(),
  WHATSAPP_CONTACT: z.string(),
  ADDRESS: z.string(),

  // JWT Authentication
  JWT_SECRET: z.string(),
  PEPPER_PASSWORD: z.string(),

  // Developer information
  DEVELOPER_IP: z.string(),
  DEVELOPER_EMAIL: z.string().email(),
  DEVELOPER_PASSWORD: z.string(),
  DEVELOPER_GITHUB: z.string().url(),
  REPOSITORY_PROJECT_URL: z.string().url(),

  // Database configuration
  POSTGRES_USER: z.string().default('app_user'),
  POSTGRES_PASSWORD: z.string().default('app_password'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default('bbz_db'),
  DATABASE_URL: z.string(),

  // Email configuration
  EMAIL_HOST_USER: z.string().email(),
  EMAIL_HOST_PASSWORD: z.string(),
  EMAIL_HOST_SMTP: z.string(),
  EMAIL_HOST_PORT: z.coerce.number().default(587),
  EMAIL_FROM: z.string(), // Formato: "Nome" <email@dominio.com>
  EMAIL_CLIENT: z.string().email(),

  // AWS S3 configuration
  PUBLIC_BUCKET: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),

  // Google Cloud OAuth configuration
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),

  // Social media links
  FACEBOOK_URL: z.string().url(),
  INSTAGRAM_URL: z.string().url(),
  LINKEDIN_URL: z.string().url(),
  YOUTUBE_URL: z.string().url(),

  // DLOCK configuration
  DLOCK_CLIENT_ID: z.string(),
  DLOCK_CLIENT_SECRET: z.string(),
  DLOCK_API_URL: z.string().url(),
  DLOCK_USERNAME: z.string(),
  DLOCK_PASSWORD: z.string(),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('💥 Environment variables are not valid:', _env.error.format())

  throw new InternalServerError({
    message: 'Variáveis de ambiente inválidas.',
    action: 'Revise o arquivo .env e as configurações do ambiente.',
  })
}

export const env = _env.data
