import { UnauthorizedErrorSchema } from '@/@types/http-errors-schema'
import { UnauthorizedError } from '@/infra/errors'
import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'
import { FastifyReply, FastifyRequest } from 'fastify'
import { logout } from '../token/auth-tokens-use-case'

export interface LogoutUserInput {
  request: FastifyRequest
  reply: FastifyReply
}

interface Dependencies {
  sessionRepository: PgSessionsRepository
}

export async function logoutUser(
  { request, reply }: LogoutUserInput,
  deps: Dependencies,
) {
  const { sessionRepository } = deps

  // 📌 Get userAccount and sessionId of context
  const userAccount = request.requestContext.get('userAccount')
  const sessionId = request.requestContext.get('sessionId')

  if (!userAccount || !sessionId) {
    throw new UnauthorizedError({
      message: 'Usuário não autorizado',
      action: 'Faça login para continuar',
      details: {
        where: 'user.logout',
        hasUserAccount: !!userAccount,
        hasSessionId: !!sessionId,
        reason: 'missing_auth_context',
      },
    })
  }

  // 📌 Check if the session ID is valid
  const session = await sessionRepository.checkValidSessionWithIdAndUserId(
    sessionId,
    userAccount.id,
  )

  if (!session) {
    throw new UnauthorizedError({
      message: 'Sessão inválida',
      action: 'Faça login para continuar',
      details: {
        where: 'user.logout',
        sessionId,
        userId: userAccount.id,
        reason: 'invalid_session',
      },
    })
  }

  // 📌 Delete session records: current session and expired sessions for the user. Delete cookies
  await logout({
    reply,
    userId: userAccount.id,
    sessionId,
  })

  return { message: 'Logout realizado com sucesso.' }
}

export const logoutUserCredentialSchema = {
  401: UnauthorizedErrorSchema,
}
