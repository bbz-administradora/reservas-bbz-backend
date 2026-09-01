// src/middlewares/verify-jwt.ts

import {
  ForbiddenErrorSchema,
  UnauthorizedErrorSchema,
} from '@/@types/http-errors-schema'
import { ForbiddenError, UnauthorizedError } from '@/infra/errors'
import { host } from '@/infra/hosts'
import { FastifyRequest } from 'fastify'

const CSRF_COOKIE_NAME = `${host.cookiePrefix}-csrf-token`
const SESSION_COOKIE_NAME = `${host.cookiePrefix}-session-token`
const REFRESH_COOKIE_NAME = `${host.cookiePrefix}-refresh-token`

/**
 * Middleware para verificar o token CSRF em métodos que alteram o estado do servidor.
 *
 * Este middleware verifica se o token CSRF enviado no cabeçalho da requisição
 * (`x-csrf-token`) corresponde ao token armazenado no cookie `${cookiePrefix}-csrf-token`.
 *
 * Ele é aplicado apenas a métodos HTTP mutáveis: `POST`, `PUT`, `PATCH`, `DELETE`.
 *
 * @param {FastifyRequest} request - O objeto de requisição do Fastify.
 * @param {string} [tokenPayloadCsrf] - Token CSRF extraído do payload JWT (método mais seguro).
 * @throws {ForbiddenError} Lança um erro com status `403` caso os tokens não correspondam.
 */
export function verifyCSRFToken(
  request: FastifyRequest,
  tokenPayloadCsrf?: string,
) {
  // 📌 Verifica se o método HTTP é mutável
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return

  const csrfTokenFromHeader = request.headers['x-csrf-token']

  // Se não há token no header, já podemos lançar erro
  if (!csrfTokenFromHeader) {
    throw new ForbiddenError({
      message: 'CSRF token ausente no cabeçalho da requisição.',
      action:
        'Certifique-se de que o token CSRF está presente no cabeçalho X-CSRF-Token.',
    })
  }

  // Verifica primeiro pelo token CSRF do payload JWT (método principal e mais seguro)
  if (tokenPayloadCsrf) {
    if (tokenPayloadCsrf === csrfTokenFromHeader) {
      // Tokens correspondem, autenticação bem-sucedida
      return
    } else {
      // Tokens não correspondem, rejeita imediatamente
      throw new ForbiddenError({
        message:
          'CSRF token do header não corresponde ao token armazenado no JWT.',
        action:
          'Certifique-se de que o token CSRF está correto no cabeçalho da requisição.',
      })
    }
  }

  // Se chegou aqui, é porque não temos o token no payload JWT
  // Então verificamos pelo cookie como fallback (método menos seguro, mas mantido para compatibilidade)
  const csrfTokenFromCookie = request.cookies[CSRF_COOKIE_NAME]

  if (!csrfTokenFromCookie || csrfTokenFromCookie !== csrfTokenFromHeader) {
    throw new ForbiddenError({
      message:
        'CSRF token não encontrado no cookie ou não corresponde ao enviado no header.',
      action:
        'Certifique-se de que o token CSRF está correto no cabeçalho da requisição.',
    })
  }

  // Se chegou aqui, a validação pelo cookie foi bem-sucedida
}

/**
 * Middleware para verificar a validade do token JWT de sessão.
 *
 * Este middleware valida o token JWT armazenado no cookie `${cookiePrefix}-session-token`.
 * Após a validação, ele extrai os dados do usuário (`sub` e `role`) e os armazena
 * no contexto da requisição (`requestContext`).
 *
 * Também aplica a verificação de CSRF, chamando `verifyCSRFToken`.
 *
 * @param {FastifyRequest} request - O objeto de requisição do Fastify.
 * @throws {UnauthorizedError} Lança um erro com status `401` caso o token seja inválido ou esteja ausente.
 */
export async function verifyJWT(request: FastifyRequest) {
  try {
    // 1️⃣ Captura o cookie de sessão
    const sessionTokenFromCookie = request.cookies[SESSION_COOKIE_NAME]

    // 2️⃣ Verifica se o token de sessão é válido
    const data: {
      sub: string
      role: string
      csrf: string
    } = request.server.jwt.verify(sessionTokenFromCookie as string)

    // 3️⃣ Extrai `userId` e `role` do JWT e armazena no contexto da requisição
    request.requestContext.set('userId', data.sub)
    request.requestContext.set('userRole', data.role)

    // 4️⃣ Verificar CSRF token (esta função já lança seus próprios erros)
    verifyCSRFToken(request, data.csrf)
  } catch (error) {
    // 5️⃣ Tratamento de erros centralizado

    // Se for um erro de ForbiddenError (erro CSRF), preserva a mensagem original
    if (error instanceof ForbiddenError) {
      throw error
    }

    // Caso contrário, lança erro genérico de autenticação
    throw new UnauthorizedError({
      message: 'Token inválido ou expirado.',
      action: 'Realize uma nova autenticação para obter um token válido.',
    })
  }
}

/**
 * Middleware para verificar a validade do token JWT de refresh.
 *
 * Este middleware valida o token JWT armazenado no cookie `${cookiePrefix}-refresh-token`.
 * Após a validação, ele extrai os dados do usuário (`sub` e `role`) e os armazena
 * no contexto da requisição (`requestContext`).
 *
 * Também aplica a verificação de CSRF, chamando `verifyCSRFToken`.
 *
 * @param {FastifyRequest} request - O objeto de requisição do Fastify.
 * @throws {UnauthorizedError} Lança um erro com status `401` caso o token seja inválido ou esteja ausente.
 */
export async function verifyJWTRefresh(request: FastifyRequest) {
  // 1️⃣ Captura e valida o cookie de refresh token
  const refreshTokenFromCookie = request.cookies[REFRESH_COOKIE_NAME]
  if (!refreshTokenFromCookie || refreshTokenFromCookie === '') {
    throw new UnauthorizedError({
      message: 'Token de refresh ausente.',
      action: 'Certifique-se de que o token de refresh foi fornecido.',
    })
  }

  try {
    // 2️⃣ Verifica se o token de refresh é válido
    const data: {
      sub: string
      role: string
      session_id: string
      remember_me: boolean
      csrf: string
    } = await request.server.jwt.verify(refreshTokenFromCookie)

    // 3️⃣ Extrai dados do usuário e armazena no contexto
    request.requestContext.set('userId', data.sub)
    request.requestContext.set('userRole', data.role)
    request.requestContext.set('sessionId', data.session_id)
    request.requestContext.set('rememberMe', data.remember_me)

    // 4️⃣ Verificar CSRF token (esta função já lança seus próprios erros)
    verifyCSRFToken(request, data.csrf)
  } catch (error: unknown) {
    //  Tratamento de erros centralizado

    // Se for um erro de ForbiddenError (erro CSRF), preserva a mensagem original
    if (error instanceof ForbiddenError) {
      throw error
    }

    // Se for UnauthorizedError, repassa a mensagem original
    if (error instanceof UnauthorizedError) {
      throw new UnauthorizedError({
        message: error.message,
        action: error.action,
      })
    }

    // Caso contrário, lance o erro genérico de token inválido
    throw new UnauthorizedError({
      message: 'Token de refresh inválido ou expirado.',
      action:
        'Solicite um novo token de refresh realizando a autenticação novamente.',
    })
  }
}

export const verifyJWTSchema = {
  401: UnauthorizedErrorSchema,
  403: ForbiddenErrorSchema,
}

export const verifyJWTRefreshSchema = {
  401: UnauthorizedErrorSchema,
  403: ForbiddenErrorSchema,
}
