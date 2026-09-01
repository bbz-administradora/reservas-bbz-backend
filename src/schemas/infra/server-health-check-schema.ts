// src/schemas/infra/server-health-check-schema.ts
import z from 'zod'

// Schema para validar a resposta
export const serverHealthCheckResponseSchema = z
  .object({
    message: z.string(),
  })
  .describe('Server health check')
