// src/schemas/team/positions/index.ts

// Position type
export { positionTypeSchema, type PositionType } from './position-type-schema'

// Create position
export {
  createPositionBodySchema,
  createPositionParamsSchema,
  createPositionResponseSchema,
  type CreatePositionBodyInput,
  type CreatePositionParamsInput,
  type CreatePositionResponse,
} from './create-position-schema'

// List positions
export {
  listPositionsParamsSchema,
  listPositionsResponseSchema,
  type ListPositionsParamsInput,
  type ListPositionsResponse,
} from './list-positions-schema'

// Get position
export {
  getPositionParamsSchema,
  getPositionResponseSchema,
  type GetPositionParamsInput,
  type GetPositionResponse,
} from './get-position-schema'

// Remove position
export {
  removePositionParamsSchema,
  removePositionResponseSchema,
  type RemovePositionParamsInput,
  type RemovePositionResponse,
} from './remove-position-schema'

// Update supervisor
export {
  updateSupervisorBodySchema,
  updateSupervisorParamsSchema,
  updateSupervisorResponseSchema,
  type UpdateSupervisorBodyInput,
  type UpdateSupervisorParamsInput,
  type UpdateSupervisorResponse,
} from './update-supervisor-schema'
