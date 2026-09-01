import { env } from '@/infra/env'
import { host } from '@/infra/hosts'
import { verifyToken } from '@/lib/fast-jwt'
import { FastifyReply } from 'fastify'
import { v4 } from 'uuid'
import {
  deleteAllSessionsByUserId,
  deleteSessionRecord,
} from './session-use-case'

interface User {
  id: string
  role: string
}

/**
 * Converte uma string de tempo (ex: '1h', '30d', '90m') em milissegundos.
 */
function parseTimeToMilliseconds(time: string): number {
  const regex = /^(\d+)([smhd])$/
  const match = time.match(regex)

  if (!match) {
    throw new Error(
      `Invalid time format: ${time}. Use format like '1h', '30d', '90m'`,
    )
  }

  const value = Number.parseInt(match[1], 10)
  const unit = match[2]

  const unitMultipliers: Record<string, number> = {
    s: 1000, // segundos
    m: 60 * 1000, // minutos
    h: 60 * 60 * 1000, // horas
    d: 24 * 60 * 60 * 1000, // dias
  }

  return value * unitMultipliers[unit]
}

/**
 * Calcula a data de expiração baseada em uma data inicial e um período de tempo.
 */
function calculateExpirationDate(startDate: Date, time: string): Date {
  const milliseconds = parseTimeToMilliseconds(time)
  return new Date(startDate.getTime() + milliseconds)
}

export interface AuthTokens {
  sessionId: string
  csrfToken: string
  refreshToken: string
  expires: Date
}

export interface GenerateAuthTokensOptions {
  rememberMe?: boolean // default true
  sessionExpiresIn?: string // default '1h' - Tempo de expiração do session token (ex: '1h', '1d')
  refreshExpiresIn?: string // default '30d' - Tempo de expiração do refresh token (ex: '30d', '45d')
}

/**
 * Gera os tokens de sessão, refresh e CSRF, define os cookies correspondentes e retorna os tokens gerados.
 *
 * @param reply - Instância do FastifyReply para assinar os tokens JWT e setar os cookies.
 * @param user - Objeto com as propriedades 'id' e 'role' do usuário.
 * @param sessionId - ID da sessão a ser associada aos tokens.
 * @param options - Configuração opcional:
 *   - rememberMe: padrão true
 *   - sessionExpiresIn: padrão '1h' - Tempo de expiração do session token (ex: '1h', '1d')
 *   - refreshExpiresIn: padrão '30d' - Tempo de expiração do refresh token (ex: '30d', '45d')
 *
 * @returns Um objeto contendo sessionId, csrfToken, refreshToken e a data de expiração (para registro da sessão no DB).
 *
 * @example
 * // Uso com valores padrão (session: 1h, refresh: 30d)
 * await generateAuthTokens(reply, user, sessionId)
 *
 * @example
 * // Uso personalizado (session: 1d, refresh: 45d)
 * await generateAuthTokens(reply, user, sessionId, {
 *   sessionExpiresIn: '1d',
 *   refreshExpiresIn: '45d'
 * })
 */
export async function generateAuthTokens(
  reply: FastifyReply,
  user: User,
  sessionId: string,
  options?: GenerateAuthTokensOptions,
): Promise<AuthTokens> {
  const rememberMe = options?.rememberMe ?? true
  const sessionExpiresIn = options?.sessionExpiresIn ?? '1h'
  const refreshExpiresIn = options?.refreshExpiresIn ?? '30d'

  const csrfToken = v4()
  const now = new Date()

  // Define a data de expiração do registro da sessão com base no refreshExpiresIn
  const expires = calculateExpirationDate(now, refreshExpiresIn)

  // Configurações dos tokens
  const SESSION_TOKEN_EXPIRES_IN = sessionExpiresIn
  const REFRESH_TOKEN_EXPIRES_IN = refreshExpiresIn

  // Criar o token de sessão
  const sessionToken = await reply.jwtSign(
    { role: user.role, created_at: now.toISOString(), csrf: csrfToken },
    { sub: user.id, expiresIn: SESSION_TOKEN_EXPIRES_IN },
  )

  // Criar o refresh token
  const refreshToken = await reply.jwtSign(
    {
      role: user.role,
      session_id: sessionId,
      remember_me: rememberMe,
      created_at: now.toISOString(),
      csrf: csrfToken,
    },
    { sub: user.id, expiresIn: REFRESH_TOKEN_EXPIRES_IN },
  )

  // Determinar domínio para os cookies (apenas em produção)
  const isProduction = env.NODE_ENV === 'production'
  const domain = isProduction ? env.DOMAIN : undefined

  // Converte os tempos de expiração para segundos (para maxAge dos cookies)
  const sessionMaxAge = parseTimeToMilliseconds(sessionExpiresIn) / 1000
  const refreshMaxAge = parseTimeToMilliseconds(refreshExpiresIn) / 1000

  // Definir os cookies com as configurações apropriadas
  reply
    .setCookie(`${host.cookiePrefix}-session-token`, sessionToken, {
      domain,
      path: '/',
      secure: true,
      sameSite: 'lax',
      httpOnly: true,
      maxAge: sessionMaxAge,
    })
    .setCookie(`${host.cookiePrefix}-refresh-token`, refreshToken, {
      domain,
      path: '/',
      secure: true,
      sameSite: 'lax',
      httpOnly: true,
      maxAge: refreshMaxAge,
    })
    .setCookie(`${host.cookiePrefix}-csrf-token`, csrfToken, {
      domain,
      path: '/',
      secure: true,
      sameSite: 'lax',
      httpOnly: false, // Acessível via JavaScript
      maxAge: refreshMaxAge,
    })

  return {
    sessionId,
    csrfToken,
    refreshToken,
    expires,
  }
}

interface LogoutOptions {
  reply: FastifyReply
  userId: string
  sessionId?: string
  deleteAll?: boolean
}

export async function logout({
  reply,
  userId,
  sessionId,
  deleteAll = false,
}: LogoutOptions): Promise<void> {
  // Define o domínio para os cookies apenas em produção
  const isProduction = env.NODE_ENV === 'production'
  const domain = isProduction ? env.DOMAIN : undefined

  // Limpa os cookies de autenticação
  reply
    .clearCookie(`${host.cookiePrefix}-csrf-token`, { path: '/', domain })
    .clearCookie(`${host.cookiePrefix}-session-token`, { path: '/', domain })
    .clearCookie(`${host.cookiePrefix}-refresh-token`, { path: '/', domain })

  // Se deleteAll for true, deleta todas as sessões do usuário.
  // Caso contrário, se um sessionId for fornecido, deleta apenas a sessão atual.
  if (deleteAll) {
    await deleteAllSessionsByUserId(userId)
  } else if (sessionId) {
    await deleteSessionRecord(sessionId, userId)
  }
}

export interface AuthCookiesData {
  sessionPayload: {
    role: string
    created_at: string
    csrf: string
    iss: string
    sub: string
    iat: number
    exp: number
  } | null
  refreshPayload: {
    role: string
    session_id: string
    remember_me: boolean
    created_at: string
    csrf: string
    iss: string
    sub: string
    iat: number
    exp: number
  } | null
  csrfToken: string | null
}

/**
 * Extracts authentication cookies from the response and returns their decoded data.
 *
 * @param response - HTTP response containing the set-cookie header.
 * @returns An object with the decoded payloads of the session and refresh tokens, and the raw CSRF token.
 */
export function extractAuthCookies(response: any): AuthCookiesData {
  const cookies: AuthCookiesData = {
    sessionPayload: null,
    refreshPayload: null,
    csrfToken: null,
  }

  // Retrieve the 'set-cookie' header (could be an array or a single string)
  const setCookieHeader =
    response.headers?.['set-cookie'] || response.getHeader?.('set-cookie')
  if (!setCookieHeader) return cookies

  const cookiesArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader]

  cookiesArray.forEach((cookieStr: string) => {
    const sessionTokenName = `${host.cookiePrefix}-session-token`
    const refreshTokenName = `${host.cookiePrefix}-refresh-token`
    const csrfTokenName = `${host.cookiePrefix}-csrf-token`

    // Extract session token cookie
    if (cookieStr.startsWith(`${sessionTokenName}=`)) {
      const match = cookieStr.match(new RegExp(`${sessionTokenName}=([^;]+)`))
      if (match) {
        const token = match[1]
        try {
          cookies.sessionPayload = verifyToken(token)
        } catch {
          cookies.sessionPayload = null
        }
      }
    }

    // Extract refresh token cookie
    if (cookieStr.startsWith(`${refreshTokenName}=`)) {
      const match = cookieStr.match(new RegExp(`${refreshTokenName}=([^;]+)`))
      if (match) {
        const token = match[1]
        try {
          cookies.refreshPayload = verifyToken(token)
        } catch {
          cookies.refreshPayload = null
        }
      }
    }

    // Extract CSRF token cookie (this is not a JWT)
    if (cookieStr.startsWith(`${csrfTokenName}=`)) {
      const match = cookieStr.match(new RegExp(`${csrfTokenName}=([^;]+)`))
      if (match) {
        cookies.csrfToken = match[1]
      }
    }
  })

  return cookies
}

// Função auxiliar para "parsear" a string do cookie em um objeto de atributos
export function parseCookie(cookieStr: string): Record<string, string> {
  const parts = cookieStr.split(';').map((part) => part.trim())
  const cookie: Record<string, string> = {}

  // A primeira parte contém "nome=valor"
  const [name, value] = parts[0].split('=')
  cookie.name = name
  cookie.value = value

  // As demais partes são atributos
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].includes('=')) {
      const [attr, val] = parts[i].split('=')
      cookie[attr.toLowerCase()] = val
    } else {
      // Caso atributos sem valor, como HttpOnly
      cookie[parts[i].toLowerCase()] = 'true'
    }
  }

  return cookie
}
