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
  API_PORT: z.coerce.number().default(Number(process.env.PORT ?? 5000)),
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

  // Storage configuration
  // Seleciona o adapter de storage em runtime. Permite cutover e rollback da
  // migração S3 -> Supabase por variável de ambiente, sem deploy de código.
  STORAGE_DRIVER: z.enum(['s3', 'supabase']).default('s3'),

  // AWS S3 configuration (driver 's3')
  PUBLIC_BUCKET: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),

  // Supabase Storage configuration (driver 'supabase')
  // Obrigatórias quando STORAGE_DRIVER=supabase, ver superRefine abaixo.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('reservas-assets'),

  // Base pública dos assets estáticos (ícones de e-mail, SVG de erro, OG).
  // Servidos pelo próprio bucket, com a chave preservada do S3: apontar para a
  // base pública do Supabase ou para o bucket S3 troca a origem sem tocar em
  // código. Não depende de deploy do front. Sem barra no final.
  ASSETS_BASE_URL: z.string().url(),

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

/**
 * Falha no boot, e não no primeiro upload, quando o driver de storage estiver
 * ligado no Supabase sem as credenciais correspondentes.
 */
const envSchemaWithStorageRules = envSchema.superRefine((values, ctx) => {
  if (values.STORAGE_DRIVER !== 'supabase') {
    return
  }

  const obrigatorias = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_STORAGE_BUCKET',
  ] as const

  for (const chave of obrigatorias) {
    if (!values[chave]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [chave],
        message: `${chave} é obrigatória quando STORAGE_DRIVER=supabase.`,
      })
    }
  }
})

const _env = envSchemaWithStorageRules.safeParse(process.env)

if (!_env.success) {
  console.error('💥 Environment variables are not valid:', _env.error.format())

  throw new InternalServerError({
    message: 'Variáveis de ambiente inválidas.',
    action: 'Revise o arquivo .env e as configurações do ambiente.',
  })
}

export const env = _env.data
