// src/models/user/user-create-use-case.ts
import { ConflictErrorSchema } from '@/@types/http-errors-schema'
import { ConflictError } from '@/infra/errors'
import bcryptPass from '@/lib/bcrypt'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { UserCreateInput } from '@/schemas/user/user-create-schema'

export interface InputProps {
  data: UserCreateInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
  accountRepository: PgAccountsRepository
}

export async function userCreateUseCase(input: InputProps, deps: Dependencies) {
  const { name, email, role, cpf, password } = input.data

  // 📌 Verifica se email ja existe
  const userExists = await deps.usersRepository.findByEmail(email)
  if (userExists) {
    throw new ConflictError({
      message: 'Já existe um usuário com este email',
      action: 'Use outro email ou recupere sua conta',
      details: {
        where: 'user.create',
        email,
        reason: 'email_already_exists',
      },
    })
  }

  // 📌 Verifica se CPF já existe
  if (cpf) {
    const userWithCpf = await deps.usersRepository.findByCpf(cpf)
    if (userWithCpf) {
      throw new ConflictError({
        message: 'Já existe um usuário com este CPF',
        action: 'Use outro CPF ou recupere sua conta',
        details: {
          where: 'user.create',
          cpfProvided: true,
          reason: 'cpf_already_exists',
        },
      })
    }
  }

  // 📌 Hash password
  const passwordHash = await bcryptPass.hash(password)

  // 📌 Cria usuário
  const user = await deps.usersRepository.create({
    name,
    email,
    role,
    cpf,
    passwordHash,
    emailVerified: new Date(),
    emailVerifiedProvider: 'credential',
  })

  // 📌 Cria conta para o usuário
  await deps.accountRepository.create({
    userId: user.id,
    type: 'credential',
    provider: 'credential',
    providerAccountId: user.id,
  })

  return {
    user: {
      id: user.id,
      name: user.name as string,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      cpf: user.cpf as string,
    },
    message: 'Usuário criado com sucesso',
  }
}

export const userCreateUseCaseSchema = {
  409: ConflictErrorSchema,
}
