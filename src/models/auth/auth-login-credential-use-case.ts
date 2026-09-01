// src/models/auth/auth-login-credential-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  UnauthorizedErrorSchema,
} from '@/@types/http-errors-schema'
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '@/infra/errors'
import bcryptPass from '@/lib/bcrypt'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  LoginUserCredentialInput,
  LoginUserCredentialResponse,
} from '@/schemas/auth/login-user-credential-schema'
import { FastifyReply } from 'fastify/types/reply'
import { v4 } from 'uuid'
import { generateAuthTokens } from '../token/auth-tokens-use-case'
import { createSessionRecord } from '../token/session-use-case'

interface InputProps {
  data: LoginUserCredentialInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
}

export async function authLoginCredentialUseCase(
  input: InputProps,
  deps: Dependencies,
  reply: FastifyReply,
): Promise<LoginUserCredentialResponse> {
  const { email, password } = input.data

  // 📌 Verifica se o usuário existe
  const user = await deps.usersRepository.findByEmail(email)
  if (!user) {
    throw new BadRequestError({
      message: 'Usuário não encontrado',
      action: 'Verifique suas credenciais ou procure o suporte',
      details: {
        where: 'auth.loginCredential',
        email,
      },
    })
  }

  // 📌 Verifica se o usuário está ativo
  if (!user.accountStatus) {
    throw new ForbiddenError({
      message: 'Conta de usuário desativada',
      action: 'Entre em contato com o suporte para mais informações',
      details: {
        where: 'auth.loginCredential',
        userId: user.id,
        email,
        accountStatus: user.accountStatus,
      },
    })
  }

  // 📌 Verifica se o usuário precisa redefinir a senha
  if (user.passwordResetRequired) {
    throw new BadRequestError({
      message: 'Redefinição de senha necessária',
      action: 'Redefina sua senha antes de prosseguir',
      details: {
        where: 'auth.loginCredential',
        userId: user.id,
        email,
        passwordResetRequired: user.passwordResetRequired,
      },
    })
  }

  // 📌 Verificar se a senha é correta
  const isPasswordCorrect = await bcryptPass.compare(
    password,
    user.passwordHash as string,
  )
  if (!isPasswordCorrect) {
    throw new UnauthorizedError({
      message: 'Usuário ou senha inválidos',
      action: 'Verifique suas credenciais e tente novamente',
      details: {
        where: 'auth.loginCredential',
        userId: user.id,
        email,
        reason: 'password_mismatch',
      },
    })
  }

  // 📌 Cria tokens
  const { sessionId, refreshToken, expires } = await generateAuthTokens(
    reply,
    { id: user.id, role: user.role },
    v4(), // ❗ generate new sessionId
    { rememberMe: true },
  )

  // 📌 Cria sessão e deleta todas as sessões vencidas do usuário
  await createSessionRecord({
    sessionId,
    refreshToken,
    userId: user.id,
    expires,
    rememberMe: true,
  })

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      cpf: user.cpf,
    },
    message: 'Usuário autenticado com sucesso',
  }
}

export const authLoginCredentialUseCaseSchema = {
  400: BadRequestErrorSchema,
  401: UnauthorizedErrorSchema,
  403: ForbiddenErrorSchema,
}
