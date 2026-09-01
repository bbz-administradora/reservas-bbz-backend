// src/repositories/base/sessions-repository.ts

export interface SessionDb {
  session_id: string
  user_id: string
  expires: Date
  remember_me: boolean
  created_at: Date
}

export interface SessionCreate {
  sessionId: string
  userId: string
  expires: Date
  rememberMe?: boolean
}

export interface SessionUpdate {
  sessionId: string
  userId?: string
  expires?: Date
  rememberMe?: boolean
}

export interface Session {
  sessionId: string
  userId: string
  expires: Date
  rememberMe: boolean
  createdAt: Date
}

export interface ISessionRepository {
  create(session: SessionCreate): Promise<Session>
  update(session: SessionUpdate): Promise<Session>
  deleteById(sessionId: string): Promise<void>
  findById(sessionId: string): Promise<Session | null>
  deleteAllExpiredSessionsByUserId(userId: string): Promise<void>
  deleteAllSessionsByUserId(userId: string): Promise<void>
  deleteSessionBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<void>
  findSessionsByUserId(userId: string): Promise<Session[]>
  checkValidSessionWithIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<Session | null>
}
