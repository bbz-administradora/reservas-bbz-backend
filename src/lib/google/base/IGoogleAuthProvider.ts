export interface GoogleTokenResponse {
  accessToken: string
  accessTokenExpiryIn: number
  scope: string
  tokenType: string
  idToken: string
  refreshToken?: string
  refreshTokenExpiresIn?: number
}

export interface GoogleUserInfo {
  email: string
  verifiedEmail: boolean
  name: string
  picture: string
}

/**
 * Port: abstrai a troca de código e a leitura de perfil Google.
 */
export interface IGoogleAuthProvider {
  exchangeCodeForGoogleTokens(code: string): Promise<GoogleTokenResponse>
  fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo>
}
