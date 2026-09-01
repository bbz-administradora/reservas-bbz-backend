// src/models/space/space-open-door-use-case.ts
import { NotFoundErrorSchema } from '@/@types/http-errors-schema'
import { env } from '@/infra/env'
import { NotFoundError } from '@/infra/errors'
import { PgAccountsRepository } from '@/repositories/pg/pg-accounts-repository'
import { PgSpaceCheckInOutRepository } from '@/repositories/pg/pg-space-check-in-out-repository'
import { PgSpaceReservationRepository } from '@/repositories/pg/pg-space-reservation-repository'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import { addHours, startOfHour } from 'date-fns'
import { format, toZonedTime } from 'date-fns-tz'
import { FastifyRequest } from 'fastify'

export interface OpenDoorInput {
  query: {
    spaceName: string
    reservationId: string
  }
}

interface Dependencies {
  spacesRepository: PgSpacesRepository
  accountRepository: PgAccountsRepository
  userRepository: PgUsersRepository
  spaceCheckInOutRepository: PgSpaceCheckInOutRepository
  spaceReservationRepository: PgSpaceReservationRepository
}

interface DlockAuthRefreshResponse {
  access_token: string
  refresh_token: string
  openid: number
  scope: string
  token_type: string
  expires_in: number
}

interface DlockAuthResponse extends DlockAuthRefreshResponse {
  uid: number
}

export interface DlockLockVersion {
  showAdminKbpwdFlag: boolean
  groupId: number
  protocolVersion: number
  protocolType: number
  orgId: number
  logoUrl: string
  scene: number
}

export interface DlockLock {
  date: number
  specialValue: number
  lockAlias: string
  noKeyPwd: string
  electricQuantityUpdateDate: number
  lockMac: string
  passageMode: number
  timezoneRawOffset: number
  lockId: number
  featureValue: string
  electricQuantity: number
  bindDate: number
  lockData: string
  hasGateway: number
  keyboardPwdVersion: number
  wirelessKeypadFeatureValue: string
  lockVersion: DlockLockVersion
  lockName: string
}

export interface DlockLockListResponse {
  list: DlockLock[]
  pageNo: number
  pageSize: number
  pages: number
  total: number
}

interface DlockKeyboardPwdResponse {
  keyboardPwd: string
  keyboardPwdId: number
}

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60

export async function openDoor(
  { query }: OpenDoorInput,
  deps: Dependencies,
  request: FastifyRequest,
) {
  // 📌 Verifica se o espaço existe
  const spaceExists = await deps.spacesRepository.findByName(query.spaceName)

  if (!spaceExists) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o nome do espaço e tente novamente',
      details: {
        where: 'space.openDoor',
        spaceName: query.spaceName,
        reservationId: query.reservationId,
      },
    })
  }

  // 📌 Verifica usuário logado
  const userAccount = request.requestContext.get('userAccount')

  // 📌 Verifica se a role é user e busca se existe check-in para este espaço
  if (userAccount && userAccount.role === 'user') {
    // 📌 Verifica se a reserva existe
    const reservationExists = await deps.spaceReservationRepository.findById(
      query.reservationId,
    )
    if (!reservationExists) {
      throw new NotFoundError({
        message: 'Reserva não encontrada',
        action: 'Verifique se você tem uma reserva ativa para este espaço',
        details: {
          where: 'space.openDoor',
          reservationId: query.reservationId,
          spaceName: query.spaceName,
          userId: userAccount.id,
        },
      })
    }

    // 📌 verifica se existe algum check-in
    const checkInExists =
      await deps.spaceCheckInOutRepository.findCheckInByReservationId(
        reservationExists.id,
      )

    if (checkInExists.length === 0) {
      throw new NotFoundError({
        message: 'Check-in não encontrado',
        action: 'Você precisa fazer check-in para abrir a porta deste espaço',
        details: {
          where: 'space.openDoor',
          reservationId: reservationExists.id,
          spaceName: query.spaceName,
          userId: userAccount.id,
          reason: 'no_check_in_found',
        },
      })
    }
  }

  // 📌 Verifica accounts provider dlock
  let accountExists = await deps.accountRepository.findByProvider('dlock')

  // 📌 Se não existir, cria uma conta dlock e armazena os tokens
  if (!accountExists) {
    let dlockAuthData: DlockAuthResponse

    // 📌 Faz chamada api Dlock e pega os tokens
    try {
      // https://euopen.sciener.com/document/doc?urlName=cloud%2Foauth2%2FgetAccessTokenEn.html
      const dlockAuthResponse = await fetch(
        `${env.DLOCK_API_URL}/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            clientId: env.DLOCK_CLIENT_ID,
            clientSecret: env.DLOCK_CLIENT_SECRET,
            // ❗❗❗ Este email (username) tem que estar cadastrado no sistema e deve ser o mesmo da conta Dlock
            username: env.DLOCK_USERNAME, // dlock account (email)
            /// ❗❗❗ A senha deve ser a senha com hash MD5
            password: env.DLOCK_PASSWORD,
          }),
        },
      )

      const responseBody = (await dlockAuthResponse.json()) as any

      if (responseBody.errcode && responseBody.errcode !== 0) {
        console.error('🚨 Erro da Dlock API:', responseBody)

        // manda o erro para o try catch
        throw new Error()
      }

      dlockAuthData = responseBody as DlockAuthResponse
    } catch (error) {
      console.error('🚨 Erro ao autenticar com Dlock:', error)

      throw new NotFoundError({
        message: 'Erro ao autenticar com Dlock',
        action: 'Tente novamente mais tarde',
      })
    }

    // 📌 Pega dados do usuário (mesmo email cadastrado no app DLock deve ser cadastrado no sistema)
    const user = await deps.userRepository.findByEmail(env.DLOCK_USERNAME)
    if (!user) {
      throw new NotFoundError({
        message: 'Usuário não encontrado',
        action:
          'O email utilizado para autenticação Dlock deve estar cadastrado no sistema',
      })
    }

    // 📌 Cria a conta dlock no banco de dados
    await deps.accountRepository.create({
      userId: user.id,
      type: 'oauth',
      provider: 'dlock',
      providerAccountId: dlockAuthData.uid.toString(),
      refreshToken: dlockAuthData.refresh_token,
      accessToken: dlockAuthData.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + dlockAuthData.expires_in, // expires_in is in seconds
      tokenType: dlockAuthData.token_type,
      scope: dlockAuthData.scope,
    })
  }

  // 📌 Verifica se validade do token é menor que 30 dias
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const willExpireSoon =
    (accountExists?.expiresAt as number) - nowInSeconds < THIRTY_DAYS_IN_SECONDS

  // 📌 Se o token vai expirar em menos de 30 dias, faz o refresh do token
  if (willExpireSoon) {
    let dlockAuthRefreshData: DlockAuthRefreshResponse

    // 📌 Faz chamada api Dlock e faz o refresh token
    try {
      // https://euopen.sciener.com/document/doc?urlName=cloud%2Foauth2%2FrefreshAccessTokenEn.html
      const dlockAuthResponse = await fetch(
        `${env.DLOCK_API_URL}/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            clientId: env.DLOCK_CLIENT_ID,
            clientSecret: env.DLOCK_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: accountExists?.refreshToken as string,
          }),
        },
      )

      const responseBody = (await dlockAuthResponse.json()) as any

      if (responseBody.errcode && responseBody.errcode !== 0) {
        console.error('🚨 Erro da Dlock API:', responseBody)

        // manda o erro para o try catch
        throw new Error()
      }

      dlockAuthRefreshData = responseBody as DlockAuthRefreshResponse
    } catch (error) {
      console.error('🚨 Erro ao fazer refresh token com Dlock:', error)

      throw new NotFoundError({
        message: 'Erro ao fazer refresh token com Dlock',
        action: 'Tente novamente mais tarde',
      })
    }

    // 📌 Atualiza a conta dlock no banco de dados
    await deps.accountRepository.update({
      id: accountExists?.id as string,
      refreshToken: dlockAuthRefreshData.refresh_token,
      accessToken: dlockAuthRefreshData.access_token,
      expiresAt:
        Math.floor(Date.now() / 1000) + dlockAuthRefreshData.expires_in, // expires_in is in seconds
    })

    accountExists = await deps.accountRepository.findByProvider('dlock')
  }

  // 📌 Pega a lista de fechaduras cadastradas
  let locks: DlockLockListResponse
  try {
    const timestamp = Date.now()

    // https://euopen.sciener.com/document/doc?urlName=cloud%2Flock%2FlistEn.html
    const url = new URL(`${env.DLOCK_API_URL}/v3/lock/list`)
    url.searchParams.set('clientId', env.DLOCK_CLIENT_ID)
    url.searchParams.set('accessToken', accountExists?.accessToken as string)
    url.searchParams.set('pageNo', '1')
    url.searchParams.set('pageSize', '100')
    url.searchParams.set('date', timestamp.toString())

    const dlockLocksResponse = await fetch(url.toString(), {
      method: 'GET',
    })

    if (!dlockLocksResponse.ok) {
      throw new NotFoundError({
        message: 'Erro ao buscar lista de fechaduras na Dlock',
        action: 'Tente novamente mais tarde',
      })
    }

    const responseBody = (await dlockLocksResponse.json()) as any

    if (responseBody.errcode && responseBody.errcode !== 0) {
      console.error('🚨 Erro da Dlock API:', responseBody)

      // manda o erro para o try catch
      throw new Error()
    }

    locks = responseBody as DlockLockListResponse
  } catch (error) {
    console.error('🚨 Erro ao buscar lista de fechaduras na Dlock:', error)

    throw new NotFoundError({
      message: 'Erro ao buscar lista de fechaduras',
      action: 'Tente novamente mais tarde',
    })
  }

  // 📌 Verifica se a fechadura do espaço existe na lista de fechaduras
  const normalizedSpaceName = query.spaceName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')

  const lock = locks.list.find((lock) => {
    return lock.lockAlias === normalizedSpaceName
  })

  if (!lock) {
    throw new NotFoundError({
      message: 'Fechadura não encontrada',
      action: `Verifique se a fechadura está cadastrada na Dlock com o nome "${normalizedSpaceName}"`,
    })
  }

  // 📌 Gera um código de abertura temporário
  let doorCode: DlockKeyboardPwdResponse

  try {
    const now = new Date()

    // Verifica se precisa jogar para a próxima hora
    const shouldGoNextHour = now.getMinutes() >= 50
    const durationInHours = shouldGoNextHour ? 2 : 1

    // Start da hora
    const start = startOfHour(now) // Sempre hora atual
    const startDate = start.getTime()

    // 1h ou 2h conforme o minuto (se usuário gerar a senha com minuto >= 50, joga para a próxima hora e mantém o inicio da hora atual). Não importa a hora de inicio a api vai considerar o inicio da hora atual ex: 10:27 = 10:00, se pedir a senha < 50 minutos, vai gerar a senha para 1h, se pedir a senha >= 50 minutos, vai gerar a senha para 2h, mas sempre com o início da hora atual (ex: 10:27 = 10:00).
    const end = addHours(start, durationInHours)
    const endDate = end.getTime()

    // Timestamp atual (pra request)
    const timestampNow = Date.now()

    const dlockPasscodeResponse = await fetch(
      `${env.DLOCK_API_URL}/v3/keyboardPwd/get`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          clientId: env.DLOCK_CLIENT_ID,
          accessToken: accountExists?.accessToken as string,
          lockId: lock.lockId.toString(),
          keyboardPwdType: '3', // 3 = Period
          keyboardPwdName: normalizedSpaceName, // opcional: nome da senha
          startDate: startDate.toString(),
          endDate: endDate.toString(),
          date: timestampNow.toString(),
        }),
      },
    )

    const responseBody = (await dlockPasscodeResponse.json()) as any

    if (responseBody.errcode && responseBody.errcode !== 0) {
      console.error('🚨 Erro da Dlock API:', responseBody)

      // manda o erro para o try catch
      throw new Error()
    }

    doorCode = responseBody as DlockKeyboardPwdResponse
  } catch (error) {
    console.error('🚨 Erro ao gerar código de abertura na Dlock:', error)

    throw new NotFoundError({
      message: 'Erro ao gerar código de abertura na Dlock',
      action: 'Tente novamente mais tarde',
    })
  }

  // 📌 Ajustar a data de vencimento do código de abertura
  const saoPauloTimeZone = 'America/Sao_Paulo'
  const expirationUtcDate = addHours(startOfHour(new Date()), 1)
  const expirationSaoPauloDate = toZonedTime(
    expirationUtcDate,
    saoPauloTimeZone,
  )

  const expiresAtFormatted = format(
    expirationSaoPauloDate,
    'dd/MM/yyyy HH:mm',
    { timeZone: saoPauloTimeZone },
  )

  return {
    space: {
      id: spaceExists.id,
      name: spaceExists.name,
      type: spaceExists.type,
    },
    doorCode: doorCode.keyboardPwd,
    expiresAt: expiresAtFormatted,
    message: 'Código de abertura da porta gerado com sucesso',
  }
}

export const openDoorSchema = {
  404: NotFoundErrorSchema,
}
