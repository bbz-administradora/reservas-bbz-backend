// src/schemas/auth/login-user-google-schema.ts
import z from 'zod'

// Schema para validar a resposta do endpoint de login com Google
export const loginUserGoogleResponseSchema = z
  .null()
  .describe('Redirecionamento para o Google OAuth')
