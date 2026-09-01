// src/models/auth/auth-reset-password-use-case.ts
import {
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  UnauthorizedErrorSchema,
} from '@/@types/http-errors-schema'
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/infra/errors'
import bcryptPass from '@/lib/bcrypt'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { PgVerificationTokenRepository } from '@/repositories/pg/pg-verification-tokens-repository'
import {
  ResetPasswordInput,
  ResetPasswordResponse,
} from '@/schemas/auth/reset-password-schema'
import { deleteAllSessionsByUserId } from '../token/session-use-case'

interface InputProps {
  data: ResetPasswordInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
  verificationTokensRepository: PgVerificationTokenRepository
}

export async function authResetPasswordUseCase(
  input: InputProps,
  deps: Dependencies,
): Promise<ResetPasswordResponse> {
  const { userId, token, password } = input.data

  // Verificar se o token existe e é válido
  const verificationToken =
    await deps.verificationTokensRepository.findValidTokenByToken(token)

  if (!verificationToken) {
    throw new NotFoundError({
      message: 'Token de redefinição de senha não encontrado',
      action:
        'Verifique o link ou solicite um novo link de redefinição de senha',
      details: {
        where: 'auth.resetPassword',
        userId,
        tokenProvided: token ? `${token.substring(0, 8)}...` : null,
      },
    })
  }

  // Verificar se o token está associado ao usuário correto
  if (verificationToken.userId !== userId) {
    throw new UnauthorizedError({
      message: 'Token de redefinição de senha inválido para este usuário',
      action:
        'Verifique o link ou solicite um novo link de redefinição de senha',
      details: {
        where: 'auth.resetPassword',
        userId,
        tokenUserId: verificationToken.userId,
        reason: 'user_mismatch',
      },
    })
  }

  // Verificar se o token é do tipo correto
  if (verificationToken.tokenType !== 'FORGOT_PASSWORD') {
    throw new UnauthorizedError({
      message: 'Token de redefinição de senha inválido',
      action:
        'Verifique o link ou solicite um novo link de redefinição de senha',
      details: {
        where: 'auth.resetPassword',
        userId,
        tokenType: verificationToken.tokenType,
        expectedTokenType: 'FORGOT_PASSWORD',
        reason: 'invalid_token_type',
      },
    })
  }

  // Buscar usuário
  const user = await deps.usersRepository.findById(userId)

  if (!user) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action:
        'Verifique o link ou solicite um novo link de redefinição de senha',
      details: {
        where: 'auth.resetPassword',
        userId,
      },
    })
  }

  // Verifica o status da conta do usuário
  if (!user.accountStatus) {
    throw new ForbiddenError({
      message: 'Conta de usuário desativada',
      action: 'Entre em contato com o suporte para mais informações',
      details: {
        where: 'auth.resetPassword',
        userId,
        accountStatus: user.accountStatus,
      },
    })
  }

  // Encriptar a nova senha
  const hashedPassword = await bcryptPass.hash(password)

  // Executar em paralelo: atualização da senha, deleção do token e deleção das sessões
  await Promise.all([
    // 1. Atualizar a senha do usuário e remover flag de reset de senha
    deps.usersRepository.update({
      id: userId,
      passwordHash: hashedPassword,
      passwordResetRequired: false, // Remove a flag de reset de senha
    }),

    // 2. Apagar o token de redefinição de senha utilizado
    deps.verificationTokensRepository.deleteByToken(token),

    // 3. Apagar todas as seções ativas do usuário
    deleteAllSessionsByUserId(userId),
  ])

  return {
    userId,
    message: 'Senha redefinida com sucesso',
  }
}

export const authResetPasswordUseCaseSchema = {
  401: UnauthorizedErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
