import { env } from './env'

const isProduction = env.NODE_ENV === 'production'

const web = isProduction
  ? `https://${env.WEB_APP_URL}`
  : `http://localhost:${env.WEB_APP_URL_PORT}`

const webAdmin = isProduction
  ? `https://${env.WEB_ADM_APP_URL}`
  : `http://localhost:${env.WEB_ADM_APP_URL_PORT}`

const api = isProduction
  ? `https://${env.API_URL}`
  : `http://localhost:${env.API_PORT}`

const cookiePrefix = 'bbz-server-auth'

const host = Object.freeze({
  web,
  webAdmin,
  api,
  cookiePrefix,
})

export { host }
