import { logoutUserController } from '@/api/v1/private/auth/logout/logout-user'
import { refreshUserSessionController } from '@/api/v1/private/auth/refresh/refresh-user-session'
import { authForgotPasswordController } from '@/api/v1/public/auth/forgot-password/auth-forgot-password'
import { authLoginCredentialController } from '@/api/v1/public/auth/login/credential/auth-login-credential'
import { loginGoogleCallbackController } from '@/api/v1/public/auth/login/google/callback/login-user-google-callback'
import { loginGoogleController } from '@/api/v1/public/auth/login/google/login-user-google'
import { authResetPasswordController } from '@/api/v1/public/auth/reset-password/auth-reset-password'
import { FastifyInstance } from 'fastify'

export async function authRoutes(app: FastifyInstance) {
  // Rotas de login com Google
  await app.register(loginGoogleController)
  await app.register(loginGoogleCallbackController)

  // Rota de login com credenciais
  await app.register(authLoginCredentialController)

  // Rota de recuperação de senha
  await app.register(authForgotPasswordController)
  await app.register(authResetPasswordController)

  // Outras rotas de autenticação
  await app.register(logoutUserController)
  await app.register(refreshUserSessionController)
}
