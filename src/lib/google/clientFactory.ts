import { env } from '@/infra/env'
import { OAuth2Client } from 'google-auth-library'

/**
 * Factory: sempre que precisar de um OAuth2Client configurado, importe daqui.
 */
export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  )
}
