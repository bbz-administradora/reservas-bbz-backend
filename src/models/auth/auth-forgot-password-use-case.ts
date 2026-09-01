// src/models/auth/auth-forgot-password-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError } from '@/infra/errors'
import { host } from '@/infra/hosts'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { PgVerificationTokenRepository } from '@/repositories/pg/pg-verification-tokens-repository'
import {
  ForgotPasswordInput,
  ForgotPasswordResponse,
} from '@/schemas/auth/forgot-password-schema'
import { sendEmail } from '@/utils/email'
import { createVerificationToken } from '../token/create-verification-token-use-case'

interface InputProps {
  data: ForgotPasswordInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
  verificationTokensRepository: PgVerificationTokenRepository
}

export async function authForgotPasswordUseCase(
  input: InputProps,
  deps: Dependencies,
): Promise<ForgotPasswordResponse> {
  const { email } = input.data

  // Verificar se o usuário existe com o email fornecido
  const user = await deps.usersRepository.findByEmail(email)

  if (!user) {
    throw new BadRequestError({
      message: 'Usuário não encontrado',
      action: 'Verifique o email informado e tente novamente',
      details: {
        where: 'auth.forgotPassword',
        email,
      },
    })
  }

  // Verifica o status da conta do usuário
  if (!user.accountStatus) {
    throw new ForbiddenError({
      message: 'Conta de usuário desativada',
      action: 'Entre em contato com o suporte para mais informações',
      details: {
        where: 'auth.forgotPassword',
        userId: user.id,
        email,
        accountStatus: user.accountStatus,
      },
    })
  }

  // Cria um token de verificação para redefinição de senha
  const tokenData = await createVerificationToken({
    userId: user.id,
    tokenType: 'FORGOT_PASSWORD',
  })

  const url = `${host.webAdmin}/redefinir-senha/${user.id}/${tokenData.token}`

  // Enviar email FORGOT_PASSWORD
  await sendEmail({
    type: 'FORGOT_PASSWORD',
    data: {
      url,
    },
    to: user.email,
    userId: user.id,
  })

  return {
    userId: user.id,
    message: 'Token de redefinição de senha enviado com sucesso',
  }
}

export const authForgotPasswordUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
}
