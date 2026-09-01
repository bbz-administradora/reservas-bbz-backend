import { env } from '@/infra/env'
import {
  Algorithm,
  createDecoder,
  createSigner,
  createVerifier,
} from 'fast-jwt'

// Algoritmo de assinatura padrão
const DEFAULT_ALGORITHM: Algorithm = 'HS256'

// Função para gerar um token JWT com expiração customizável
export function signToken(payload: object, expiresIn: string = '10m'): string {
  const signSync = createSigner({
    key: env.JWT_SECRET,
    expiresIn,
    algorithm: DEFAULT_ALGORITHM,
  })
  return signSync(payload)
}

// Função para verificar e decodificar um token JWT
export function verifyToken(token: string) {
  const verifySync = createVerifier({
    key: env.JWT_SECRET,
    algorithms: [DEFAULT_ALGORITHM],
  })
  return verifySync(token)
}

// Função para decodificar um token JWT sem verificação
export function decodeToken(token: string) {
  const decodeSync = createDecoder() // Cria a função de decodificação
  return decodeSync(token)
}

// Função para gerar um token de sessão expirado
export function createExpiredSessionToken(payload: object): string {
  // Define o tempo de expiração para o passado (1 hora atrás)
  const expiredPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) - 3600, // Expirado há 1 hora
  }
  const signSync = createSigner({
    key: env.JWT_SECRET,
    algorithm: DEFAULT_ALGORITHM,
  })
  return signSync(expiredPayload)
}
