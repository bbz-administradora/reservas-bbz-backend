// src/schemas/team/positions/position-type-schema.ts
import z from 'zod'

/**
 * Tipos de posições válidas na equipe de atendimento
 *
 * Hierarquia:
 * - director (level 1): Único, nomeia supervisores
 * - supervisor (level 2): ~7, nomeia gerentes
 * - manager (level 3): ~56, nomeia subgerentes e assistentes
 * - assistant_manager (level 4): ~20, subgerente do núcleo
 * - assistant (level 5): ~54, base da equipe
 */
export const positionTypeSchema = z.enum([
  'director',
  'supervisor',
  'manager',
  'assistant_manager',
  'assistant',
])

export type PositionType = z.infer<typeof positionTypeSchema>
