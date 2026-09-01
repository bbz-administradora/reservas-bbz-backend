import { BadRequestError, BaseError, ForbiddenError } from '@/infra/errors'
import { IGoogleAuthProvider } from '@/lib/google/base/IGoogleAuthProvider'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { FastifyReply } from 'fastify'
import { v4 } from 'uuid'
import { generateAuthTokens } from '../token/auth-tokens-use-case'
import { createSessionRecord } from '../token/session-use-case'

interface LoginUserGoogleInput {
  code: string
  scope?: string
  authUser?: string
  prompt?: string
  state?: string
}

interface Dependencies {
  userRepository: PgUsersRepository
  accountRepository: PgAccountsRepository
  googleAuthProvider: IGoogleAuthProvider
}

export async function loginUserGoogleUseCase(
  { code, state }: LoginUserGoogleInput,
  deps: Dependencies,
  reply: FastifyReply,
) {
  try {
    // 📌 Trocar o código de autorização por tokens
    const tokenInfo =
      await deps.googleAuthProvider.exchangeCodeForGoogleTokens(code)

    // 📌 Obter informações do usuário usando o accessToken
    const userInfo = await deps.googleAuthProvider.fetchGoogleUserInfo(
      tokenInfo.accessToken,
    )

    // 📌 Verifica account
    const userAccount = await deps.userRepository.findByEmailWithProvider(
      userInfo.email,
      'google',
    )

    if (!userAccount) {
      throw new BadRequestError({
        message: 'Usuário não encontrado',
        action: 'Verifique suas credenciais ou procure o suporte',
        details: {
          where: 'user.loginGoogle',
          googleEmail: userInfo.email,
          reason: 'user_not_found',
        },
      })
    }

    // 📌 Verifica se o usuário está ativo
    if (!userAccount.accountStatus) {
      throw new ForbiddenError({
        message: 'Conta de usuário desativada',
        action: 'Entre em contato com o suporte para mais informações',
        details: {
          where: 'user.loginGoogle',
          userId: userAccount.id,
          accountStatus: userAccount.accountStatus,
          reason: 'account_disabled',
        },
      })
    }

    // 📌 Verifica se o usuário precisa redefinir a senha
    if (userAccount.passwordResetRequired) {
      throw new BadRequestError({
        message: 'Redefinição de senha necessária',
        action: 'Redefina sua senha antes de prosseguir',
        details: {
          where: 'user.loginGoogle',
          userId: userAccount.id,
          passwordResetRequired: userAccount.passwordResetRequired,
          reason: 'password_reset_required',
        },
      })
    }

    // 📌 Atualizar dados do usuário
    if (
      !userAccount.avatar ||
      !userAccount.name ||
      !userAccount.emailVerified
    ) {
      await deps.userRepository.update({
        id: userAccount.id,
        name: userAccount.name || userInfo.name,
        email: userAccount.email,
        avatar: userAccount.avatar || userInfo.picture,
        emailVerified:
          !userAccount.emailVerified && userInfo.verifiedEmail
            ? new Date()
            : null,
        emailVerifiedProvider:
          !userAccount.emailVerifiedProvider && userInfo.verifiedEmail
            ? 'google'
            : null,
      })
    }

    // 📌 Atualizar dados da conta
    const account = await deps.accountRepository.findByUserIdAndProvider(
      userAccount.id,
      'google',
    )

    if (!account) {
      throw new BadRequestError({
        message: 'Conta não encontrada',
        action: 'Verifique se a conta do Google está vinculada ao usuário.',
        details: {
          where: 'user.loginGoogle',
          userId: userAccount.id,
          provider: 'google',
          reason: 'google_account_not_linked',
        },
      })
    }

    await deps.accountRepository.update({
      id: account.id,
      userId: userAccount.id,
      type: 'oauth',
      provider: 'google',
      refreshToken: tokenInfo.refreshToken || null,
      accessToken: tokenInfo.accessToken || null,
      expiresAt: tokenInfo.refreshTokenExpiresIn || null,
      tokenType: tokenInfo.tokenType || null,
      scope: tokenInfo.scope || null,
      idToken: tokenInfo.idToken || null,
      sessionState: state || null,
    })

    // 📌 Cria tokens
    const { sessionId, refreshToken, expires } = await generateAuthTokens(
      reply,
      { id: userAccount.id, role: userAccount.role },
      v4(), // ❗ generate new sessionId
      { rememberMe: true },
    )

    // 📌 Cria sessão e deleta todas as sessões vencidas do usuário
    await createSessionRecord({
      sessionId,
      refreshToken,
      userId: userAccount.id,
      expires,
      rememberMe: true,
    })

    return {
      name: userInfo.name,
      message: 'Login realizado com sucesso.',
      action: 'Usuário autenticado com sucesso.',
      statusCode: 200,
    }
  } catch (error) {
    // ❗❗❗ Damos console no erro completo, incluindo o stacktrace, apenas no servidor. Teremos que fazer um redirect para o frontend, sendo assim enviamos os erros por query params, por este motivo não utilizamos o handler de erro global. Se o usarmos, o usuário não será redirecionado para o frontend e ficará preso na tela do callback do Google.❗❗❗

    // Loga o erro completo, incluindo o stacktrace, apenas no servidor
    console.error('🚨', error)

    if (error instanceof BaseError) {
      return {
        name: error.name,
        message: error.message,
        action: error.action,
        statusCode: error.statusCode,
      }
    }

    // Para todos os outros erros, retorna uma mensagem genérica padronizada
    return {
      name: 'InternalServerError',
      message: 'Erro interno do servidor.',
      action: 'Erro inesperado no servidor.',
      statusCode: 500,
    }
  }
}
