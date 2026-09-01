import { UnauthorizedErrorSchema } from '@/@types/http-errors-schema'
import { UnauthorizedError } from '@/infra/errors'
import { UserMeResponse } from '@/schemas/user/user-me-schema'

interface UserAccount {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'dev'
  accountStatus: boolean
  cpf: string | null
  teamPosition:
    | 'director'
    | 'supervisor'
    | 'manager'
    | 'assistant_manager'
    | 'assistant'
    | null
  bookingExceptionUntil: string | null
  absenceStartDate: string | null
  absenceEndDate: string | null
}

interface InputProps {
  userAccount: UserAccount | null | undefined
  data: Record<string, never> // Objeto vazio pois não há dados no body, params ou query
}

type Dependencies = Record<string, never>

export async function userMe(
  input: InputProps,
  deps: Dependencies,
): Promise<UserMeResponse> {
  const { userAccount } = input

  if (!userAccount) {
    throw new UnauthorizedError({
      message: 'Usuário não autorizado',
      action: 'Faça login para continuar',
      details: {
        where: 'user.me',
        reason: 'missing_user_account_context',
      },
    })
  }

  return {
    user: {
      id: userAccount.id,
      name: userAccount.name,
      email: userAccount.email,
      role: userAccount.role,
      accountStatus: userAccount.accountStatus,
      cpf: userAccount.cpf as string,
      teamPosition: userAccount.teamPosition,
      bookingExceptionUntil: userAccount.bookingExceptionUntil,
      absenceStartDate: userAccount.absenceStartDate,
      absenceEndDate: userAccount.absenceEndDate,
    },
    message: 'Dados do usuário recuperados com sucesso',
  }
}

export const userMeUseCaseSchema = {
  401: UnauthorizedErrorSchema,
}
