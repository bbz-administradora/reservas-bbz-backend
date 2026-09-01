import { UnauthorizedErrorSchema } from '@/@types/http-errors-schema'
import { UnauthorizedError } from '@/infra/errors'
import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'
import { RefreshUserSessionResponse } from '@/schemas/auth/refresh-user-session-schema'
import { FastifyReply, FastifyRequest } from 'fastify'
import { v4 } from 'uuid'
import { generateAuthTokens } from '../token/auth-tokens-use-case'
import { createSessionRecord } from '../token/session-use-case'

interface InputProps {
  data: Record<string, unknown>
}

interface Dependencies {
  sessionRepository: PgSessionsRepository
}

export async function refreshUserSession(
  input: InputProps,
  deps: Dependencies,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RefreshUserSessionResponse> {
  // 📌 Get userAccount and sessionId of context
  const userAccount = request.requestContext.get('userAccount')
  const oldSessionId = request.requestContext.get('sessionId')
  const rememberMe = Boolean(request.requestContext.get('rememberMe'))

  if (!userAccount || !oldSessionId) {
    throw new UnauthorizedError({
      message: 'Usuário não autorizado',
      action: 'Faça login para continuar',
    })
  }

  // 📌 Check if the session ID is valid
  const session = await deps.sessionRepository.checkValidSessionWithIdAndUserId(
    oldSessionId,
    userAccount.id,
  )

  if (!session) {
    throw new UnauthorizedError({
      message: 'Sessão inválida',
      action: 'Faça login para continuar',
    })
  }

  // 📌 Generate new sessionId
  const newSessionId = v4()

  // 📌 Generate tokens with new sessionId
  const { sessionId, refreshToken, expires } = await generateAuthTokens(
    reply,
    { id: userAccount.id, role: userAccount.role },
    newSessionId,
    { rememberMe },
  )

  // 📌 Create new session
  await createSessionRecord({
    sessionId,
    refreshToken,
    userId: userAccount.id,
    expires,
    rememberMe,
  })

  // 📌 Delete old session
  await deps.sessionRepository.deleteSessionBySessionIdAndUserId(
    oldSessionId,
    userAccount.id,
  )

  return {
    userId: userAccount.id,
    sessionId: newSessionId,
  }
}

export const refreshUserSessionSchema = {
  401: UnauthorizedErrorSchema,
}
