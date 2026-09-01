// verification-token-interfaces.ts

export type VerificationTokenType = 'PASSWORD_RESET' | 'FORGOT_PASSWORD'

export interface VerificationTokenDb {
  user_id: string
  token: string
  token_type: string
  expires: Date
  opt: string
  created_at: Date
  updated_at: Date
}

export interface VerificationTokenCreate {
  userId: string
  tokenType: VerificationTokenType
  expires: Date
}

export interface VerificationTokenUpdate {
  userId: string
  token?: string
  tokenType: VerificationTokenType
  expires?: Date
  opt?: string
}

export interface VerificationToken {
  userId: string
  token: string
  tokenType: VerificationTokenType
  expires: Date
  opt: string
  createdAt: Date
  updatedAt: Date
}

export interface IVerificationTokenRepository {
  create(data: VerificationTokenCreate): Promise<VerificationToken>
  update(data: VerificationTokenUpdate): Promise<VerificationToken>
  findTokenByTypeAndUserId(
    userId: string,
    tokenType: string,
  ): Promise<VerificationToken | null>
  findTokensByTypeAndUserId(
    userId: string,
    tokenType: string,
  ): Promise<VerificationToken[]>
  findValidTokenByToken(token: string): Promise<VerificationToken | null>
  findValidTokenByOpt(opt: string): Promise<VerificationToken | null>
  deleteByToken(token: string): Promise<void>
}
