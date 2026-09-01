// src/models/user/user-list-use-case.ts
import { BadRequestErrorSchema } from '@/@types/http-errors-schema'
import { BadRequestError } from '@/infra/errors'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { UserListQueryInput } from '@/schemas/user/user-list-schema'

interface InputProps {
  data: UserListQueryInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
}

export async function userListUseCase(input: InputProps, deps: Dependencies) {
  // Validar os parâmetros de paginação
  const page = input.data.page ?? 1
  const pageSize = input.data.pageSize ?? 1000

  if (page < 1) {
    throw new BadRequestError({
      message: 'O número da página deve ser maior ou igual a 1',
      action: 'Corrija o parâmetro page na URL',
      details: {
        where: 'user.list',
        providedPage: page,
        reason: 'invalid_page_number',
      },
    })
  }

  if (pageSize < 1 || pageSize > 1000) {
    throw new BadRequestError({
      message: 'O tamanho da página deve estar entre 1 e 1000',
      action: 'Corrija o parâmetro pageSize na URL',
      details: {
        where: 'user.list',
        providedPageSize: pageSize,
        reason: 'invalid_page_size',
      },
    })
  }

  // Filtros para a consulta
  const filters = {
    search: input.data.search,
    role: input.data.role,
    accountStatus: input.data.accountStatus,
  }

  // Buscar usuários no repositório
  const result = await deps.usersRepository.listUsers(filters, page, pageSize)

  return {
    users: result.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      cpf: user.cpf as string,
      createdAt: user.createdAt,
    })),
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    message: 'Lista de usuários recuperada com sucesso',
  }
}

export const userListUseCaseSchema = {
  400: BadRequestErrorSchema,
}
