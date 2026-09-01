// src/routes/spaceRoutes.ts
import { spaceCreateController } from '@/api/v1/private/space/create/space-create'
import { spaceDeleteController } from '@/api/v1/private/space/delete/space-delete'
import { spaceGetController } from '@/api/v1/private/space/get/space-get'
import { spaceListController } from '@/api/v1/private/space/list/space-list'
import { spaceOpenDoorController } from '@/api/v1/private/space/open-door/space-open-door'
import { spaceQrcodeController } from '@/api/v1/private/space/qrcode/space-qrcode'
import { spaceUpdateController } from '@/api/v1/private/space/update/space-update'
import { FastifyInstance } from 'fastify'

/**
 * Registra todas as rotas relacionadas a espaços
 */
export async function spaceRoutes(app: FastifyInstance) {
  app.register(spaceCreateController)
  app.register(spaceDeleteController)
  app.register(spaceGetController)
  app.register(spaceListController)
  app.register(spaceUpdateController)
  app.register(spaceOpenDoorController)
  app.register(spaceQrcodeController)
}
