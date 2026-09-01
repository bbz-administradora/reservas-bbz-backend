// src/middlewares/validate-user-account.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError } from '@/infra/errors'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { FastifyReply, FastifyRequest } from 'fastify'

interface ValidateUserAccountOptions {
  ignoreAccountStatus?: boolean // pula checagem de banimento
  ignorePasswordResetRequired?: boolean // pula checagem de reset de senha
}

/**
 * Middleware para validar e anexar a conta de usuário no contexto da requisição.
 *
 * Uso no Fastify (sempre em `preHandler`):
 *
 * ```ts
 * import { verifyJWT } from '@/middlewares/verify-jwt'
 * import { validateUserRole } from '@/middlewares/validate-user-role'
 * import { validateUserAccount } from '@/middlewares/validate-user-account'
 *
 * app.get('/v1/private/protected/data', {
 *   onRequest: [
 *     verifyJWT,
 *     validateUserRole(['admin', 'dev']),
 *   ],
 *   preHandler: [
 *     validateUserAccount({ ignoreAccountStatus, ignorePasswordResetRequired }), // roda após verifyJWT e parsing de cookies/headers
 *   ],
 *   handler: async (request, reply) => {
 *     const user = request.requestContext.get('userAccount')
 *     // ... seu código ...
 *   }
 * })
 * ```
 *
 * **Por que em `preHandler`:**
 * - Precisa que o Fastify já tenha feito o parsing de cookies/headers.
 * - Depende de `verifyJWT` ter setado o `userId` em `request.requestContext`.
 *
 * @param options.ignoreAccountStatus            Se `true`, não checa se a conta está banida.
 * @param options.ignorePasswordResetRequired    Se `true`, não checa se o usuário precisa resetar a senha.
 */
export function validateUserAccount(options: ValidateUserAccountOptions = {}) {
  const { ignoreAccountStatus = false, ignorePasswordResetRequired = false } =
    options

  return async function (request: FastifyRequest, reply: FastifyReply) {
    // 1️⃣ userId já deve ter sido setado pelo verifyJWT
    const userId = request.requestContext.get('userId') as string | undefined
    if (!userId) {
      throw new BadRequestError({
        message: 'Usuário não autorizado',
        action: 'Faça login para continuar',
        details: {
          where: 'middleware.validateUserAccount',
          reason: 'missing_user_id_context',
        },
      })
    }

    // 2️⃣ busca o usuário com teamPosition em UMA única query (otimização: evita 2 queries)
    const userRepository = new PgUsersRepository()
    const userAccount = await userRepository.findByIdWithTeamPosition(userId)
    if (!userAccount) {
      throw new BadRequestError({
        message: 'Usuário não encontrado',
        action: 'Verifique suas credenciais ou procure o suporte',
        details: {
          where: 'middleware.validateUserAccount',
          userId,
          reason: 'user_not_found',
        },
      })
    }

    // 3️⃣ checa banimento
    if (!ignoreAccountStatus && !userAccount.accountStatus) {
      throw new ForbiddenError({
        message: 'Conta de usuário desativada',
        action: 'Entre em contato com o suporte para mais informações',
        details: {
          where: 'middleware.validateUserAccount',
          userId,
          accountStatus: userAccount.accountStatus,
          reason: 'account_disabled',
        },
      })
    }

    // 4️⃣ checa reset de senha
    if (!ignorePasswordResetRequired && userAccount.passwordResetRequired) {
      throw new BadRequestError({
        message: 'Redefinição de senha necessária',
        action: 'Redefina sua senha antes de prosseguir',
        details: {
          where: 'middleware.validateUserAccount',
          userId,
          passwordResetRequired: userAccount.passwordResetRequired,
          reason: 'password_reset_required',
        },
      })
    }

    // 5️⃣ anexa para o handler (teamPosition já veio do JOIN)
    request.requestContext.set('userAccount', {
      id: userAccount.id,
      name: userAccount.name as string,
      email: userAccount.email,
      role: userAccount.role,
      accountStatus: userAccount.accountStatus,
      cpf: userAccount.cpf as string,
      teamPosition: userAccount.teamPosition,
      bookingExceptionUntil: userAccount.bookingExceptionUntil,
      absenceStartDate: userAccount.absenceStartDate,
      absenceEndDate: userAccount.absenceEndDate,
    })
  }
}

export const validateUserAccountSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
}
