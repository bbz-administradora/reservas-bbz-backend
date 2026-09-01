import '@fastify/request-context'

declare module '@fastify/request-context' {
  interface RequestContextData {
    userId: string | null
    userRole: string | null
    sessionId: string | null
    rememberMe: boolean | null
    userAccount: {
      id: string
      name: string
      email: string
      role: 'admin' | 'user' | 'dev'
      cpf: string | null
      accountStatus: boolean
      teamPosition:
        | 'director'
        | 'supervisor'
        | 'manager'
        | 'assistant_manager'
        | 'assistant'
        | null
      bookingExceptionUntil: string | null
      absenceStartDate: string | null
      absenceEndDate: string | null
    } | null
  }
}
