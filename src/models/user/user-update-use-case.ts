// src/models/user/user-update-use-case.ts
import {
  BadRequestErrorSchema,
  ConflictErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ConflictError, NotFoundError } from '@/infra/errors'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { UserUpdateInput } from '@/schemas/user/user-update-schema'

export interface InputProps {
  data: UserUpdateInput
}

interface Dependencies {
  usersRepository: PgUsersRepository
}

export async function userUpdateUseCase(input: InputProps, deps: Dependencies) {
  const { id: userId, email, cpf } = input.data

  // Check if user exists
  const userExists = await deps.usersRepository.findById(userId)

  if (!userExists) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action: 'Verifique o ID e tente novamente',
      details: {
        where: 'user.update',
        userId,
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
          where: 'user.update',
          userId,
          cpfProvided: true,
          reason: 'cpf_already_exists',
        },
      })
    }
  }

  // Check if there is data to update
  const dataToUpdate = { ...input.data }

  // Remover o ID dos campos a atualizar usando desestruturação
  const { id: _, ...fieldsToUpdate } = dataToUpdate

  if (Object.keys(fieldsToUpdate).length === 0) {
    throw new BadRequestError({
      message: 'Nenhum dado fornecido para atualização',
      action: 'Forneça pelo menos um campo para atualizar',
      details: {
        where: 'user.update',
        userId,
        reason: 'no_data_to_update',
      },
    })
  }

  // Check if email is already in use
  if (email) {
    const emailExists = await deps.usersRepository.findByEmail(email)
    if (emailExists && emailExists.id !== userId) {
      throw new ConflictError({
        message: 'E-mail já cadastrado',
        action: 'Escolha outro e-mail',
        details: {
          where: 'user.update',
          userId,
          existingUserId: emailExists.id,
          reason: 'email_already_exists',
        },
      })
    }
  }

  // Verifica se está reativando um usuário banido para zerar o contador de warnings
  const shouldResetWarningCount =
    fieldsToUpdate.accountStatus === true && userExists.accountStatus === false

  // Update user - only fields that were sent in the request
  // Se está reativando um usuário banido, zerar o contador de warnings
  let user

  if (shouldResetWarningCount) {
    // Extendemos o objeto com warningCount = 0 usando um cast para adicionar a propriedade
    user = await deps.usersRepository.update({
      id: userId,
      ...fieldsToUpdate,
      warningCount: 0,
    })
  } else {
    user = await deps.usersRepository.update({
      id: userId,
      ...fieldsToUpdate,
    })
  }

  return {
    user: {
      id: user.id,
      name: user.name as string,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      cpf: user.cpf as string,
    },
    message: 'Usuário atualizado com sucesso',
  }
}

export const userUpdateUseCaseSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
  409: ConflictErrorSchema,
}
