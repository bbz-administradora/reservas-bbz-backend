// src/models/user/user-delete-use-case.ts
import {
  ConflictErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { ConflictError, NotFoundError } from '@/infra/errors'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgSessionsRepository } from '@/repositories/pg/pg-sessions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { FastifyRequest } from 'fastify'

export interface DeleteUserInput {
  request: FastifyRequest
  params: {
    id: string
  }
}

interface Dependencies {
  usersRepository: PgUsersRepository
  accountRepository: PgAccountsRepository
  sessionRepository: PgSessionsRepository
}

export async function deleteUser(
  { request, params }: DeleteUserInput,
  deps: Dependencies,
) {
  // 📌 Check if user exists
  const userExists = await deps.usersRepository.findById(params.id)

  if (!userExists) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action: 'Verifique o ID e tente novamente',
      details: {
        where: 'user.delete',
        targetUserId: params.id,
      },
    })
  }

  // 📌 Prevent deletion of your own account
  const currentUserId = request.requestContext.get('userId')
  if (currentUserId === params.id) {
    throw new ConflictError({
      message: 'Não é possível excluir sua própria conta',
      action:
        'Use outro perfil administrativo para excluir esta conta, se necessário',
      details: {
        where: 'user.delete',
        currentUserId,
        targetUserId: params.id,
        reason: 'cannot_delete_own_account',
      },
    })
  }

  // 📌 Delete all sessions for this user
  await deps.sessionRepository.deleteAllSessionsByUserId(params.id)

  // 📌 Delete all accounts for this user
  await deps.accountRepository.deleteAllAccountsByUserId(params.id)

  // 📌 Delete user
  await deps.usersRepository.deleteById(params.id)

  return {
    message: 'Usuário excluído com sucesso',
    userId: params.id,
  }
}

export const deleteUserSchema = {
  404: NotFoundErrorSchema,
  409: ConflictErrorSchema,
}
