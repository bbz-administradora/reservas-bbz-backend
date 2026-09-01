import { env } from '@/infra/env'
import bcrypt from 'bcryptjs'

function getNumberOfRounds() {
  return env.NODE_ENV === 'production' ? 14 : 1
}

async function hash(password: string): Promise<string> {
  const rounds = getNumberOfRounds()
  return await bcrypt.hash(password + env.PEPPER_PASSWORD, rounds)
}

async function compare(
  providedPassword: string,
  storedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(
    providedPassword + env.PEPPER_PASSWORD,
    storedPassword,
  )
}

const bcryptPass = {
  hash,
  compare,
}

export default bcryptPass
