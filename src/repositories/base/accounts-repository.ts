export interface AccountDb {
  id: string
  user_id: string
  type: string
  provider: string
  provider_account_id: string
  refresh_token: string | null
  access_token: string | null
  expires_at: number | null
  token_type: string | null
  scope: string | null
  id_token: string | null
  session_state: string | null
  created_at: Date
  updated_at: Date
}

export interface AccountCreate {
  id?: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refreshToken?: string | null
  accessToken?: string | null
  expiresAt?: number | null
  tokenType?: string | null
  scope?: string | null
  idToken?: string | null
  sessionState?: string | null
}

export interface AccountUpdate {
  id: string
  userId?: string
  type?: string
  provider?: string
  providerAccountId?: string
  refreshToken?: string | null
  accessToken?: string | null
  expiresAt?: number | null
  tokenType?: string | null
  scope?: string | null
  idToken?: string | null
  sessionState?: string | null
}

export interface Account {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refreshToken: string | null
  accessToken: string | null
  expiresAt: number | null
  tokenType: string | null
  scope: string | null
  idToken: string | null
  sessionState: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IAccountRepository {
  create(account: AccountCreate): Promise<Account>
  update(account: AccountUpdate): Promise<Account>
  deleteAllAccountsByUserId(userId: string): Promise<void>
  findAllAccountsByUserId(userId: string): Promise<Account[]>
  findByUserIdAndProvider(
    userId: string,
    provider: string,
  ): Promise<Account | null>
  findByProvider(provider: string): Promise<Account | null>
}
