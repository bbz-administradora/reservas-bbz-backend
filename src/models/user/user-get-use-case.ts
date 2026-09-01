// src/models/user/user-get-use-case.ts
import { NotFoundErrorSchema } from '@/@types/http-errors-schema'
import { NotFoundError } from '@/infra/errors'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { UserGetInput, UserGetResponse } from '@/schemas/user/user-get-schema'

interface InputProps {
  data: UserGetInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
}

export async function userGetUseCase(
  input: InputProps,
  deps: Dependencies,
): Promise<UserGetResponse> {
  const { id } = input.data

  const user = await deps.usersRepository.findById(id)

  if (!user) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action: 'Verifique o ID e tente novamente',
      details: {
        where: 'user.get',
        userId: id,
      },
    })
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      cpf: user.cpf as string,
    },
    message: 'Dados do usuário recuperados com sucesso',
  }
}

export const userGetUseCaseSchema = {
  404: NotFoundErrorSchema,
}
