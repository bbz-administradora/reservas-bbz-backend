import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'

export interface SessionData {
  sessionId: string
  refreshToken: string
  userId: string
  expires: Date
  rememberMe: boolean
}

/**
 * Creates a session record in the database and deletes expired sessions for the user.
 *
 * @param sessionData - The session data to be saved.
 * @returns The created session record.
 */
export async function createSessionRecord(
  sessionData: SessionData,
): Promise<any> {
  const sessionRepository = new PgSessionsRepository()

  // Executa a criação do registro e a exclusão das sessões expiradas em paralelo
  const [createdSession] = await Promise.all([
    sessionRepository.create({
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      expires: sessionData.expires,
      rememberMe: sessionData.rememberMe,
    }),

    sessionRepository.deleteAllExpiredSessionsByUserId(sessionData.userId),
  ])

  return createdSession
}

/**
 * Deletes the current session and expired sessions for the user.
 *
 * @param sessionId
 * @param userId
 */
export async function deleteSessionRecord(
  sessionId: string,
  userId: string,
): Promise<void> {
  const sessionRepository = new PgSessionsRepository()

  // Executes deletion of the current session and expired sessions concurrently
  await Promise.all([
    sessionRepository.deleteSessionBySessionIdAndUserId(sessionId, userId),
    sessionRepository.deleteAllExpiredSessionsByUserId(userId), // delete expired sessions
  ])
}

/**
 * Deletes all sessions for the user.
 *
 * @param userId
 */
export async function deleteAllSessionsByUserId(userId: string): Promise<void> {
  const sessionRepository = new PgSessionsRepository()

  await sessionRepository.deleteAllSessionsByUserId(userId)
}
