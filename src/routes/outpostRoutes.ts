// src/routes/outpostRoutes.ts

import {
  outpostCreateController,
  outpostDeleteController,
  outpostListController,
  outpostUpdateController,
} from '@/api/v1/private/outpost'
import { FastifyInstance } from 'fastify'

export async function outpostRoutes(app: FastifyInstance) {
  app.register(outpostCreateController)
  app.register(outpostListController)
  app.register(outpostUpdateController)
  app.register(outpostDeleteController)
}
