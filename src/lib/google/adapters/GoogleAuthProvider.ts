import { env } from '@/infra/env'
import { BadRequestError } from '@/infra/errors'
import { google } from 'googleapis'
import {
  GoogleTokenResponse,
  GoogleUserInfo,
  IGoogleAuthProvider,
} from '../base/IGoogleAuthProvider'

export class GoogleAuthProvider implements IGoogleAuthProvider {
  private createClient() {
    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI,
    )
  }

  async exchangeCodeForGoogleTokens(
    code: string,
  ): Promise<GoogleTokenResponse> {
    const client = this.createClient()
    try {
      const { tokens } = await client.getToken(code)
      if (!tokens.access_token) {
        throw new BadRequestError({
          message: 'Token de acesso não recebido do Google',
          action: 'Tente fazer login novamente',
        })
      }
      const accessTokenExpiryIn = tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600

      const refreshTokenExpiresIn = tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : undefined

      return {
        accessToken: tokens.access_token,
        accessTokenExpiryIn,
        scope: tokens.scope || '',
        tokenType: tokens.token_type || 'Bearer',
        idToken: tokens.id_token || '',
        refreshToken: tokens.refresh_token || undefined,
        refreshTokenExpiresIn,
      }
    } catch (error: any) {
      console.error('Error exchanging code for Google tokens:', error)
      throw new BadRequestError({
        message: 'Falha ao trocar código por tokens do Google',
        action: 'Tente fazer login novamente',
        details: error,
      })
    }
  }

  async fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const client = this.createClient()
    client.setCredentials({ access_token: accessToken })
    const oauth2 = google.oauth2({ auth: client, version: 'v2' })

    try {
      const { data } = await oauth2.userinfo.get()
      if (!data.email) {
        throw new BadRequestError({
          message: 'Email do usuário não disponível no Google',
          action: 'Tente fazer login novamente',
        })
      }
      return {
        email: data.email,
        verifiedEmail: data.verified_email ?? false,
        name: data.name || '',
        picture: data.picture || '',
      }
    } catch (error: any) {
      console.error('Error fetching Google user info:', error)
      throw new BadRequestError({
        message: 'Falha ao obter informações do usuário Google',
        action: 'Tente fazer login novamente',
        details: error,
      })
    }
  }
}
