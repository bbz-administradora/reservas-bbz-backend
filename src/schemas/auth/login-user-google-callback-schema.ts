// src/schemas/auth/login-user-google-callback-schema.ts
import z from 'zod'

// Schema para validar os parâmetros da requisição
export const loginUserGoogleCallbackQuerySchema = z
  .object({
    code: z.string().optional().describe('Código de autorização do Google'),
    scope: z.string().optional().describe('Escopos autorizados pelo usuário'),
    authuser: z
      .string()
      .optional()
      .describe('Índice da conta Google usada na autenticação'),
    prompt: z.string().optional().describe('Tipo de prompt utilizado no login'),
    state: z
      .string()
      .optional()
      .describe('Valor usado para proteção contra CSRF'),
  })
  .describe('Parâmetros de consulta do callback de autenticação do Google')

// Schema para validar a resposta
export const loginUserGoogleCallbackResponseSchema = z
  .null()
  .describe('Redireciona para o frontend após configurar cookies de sessão')
