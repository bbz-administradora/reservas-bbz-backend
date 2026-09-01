import { catracaCatraEventController } from '@/api/v1/public/catraca/catra-event/catraca-catra-event'
import { catracaDaoController } from '@/api/v1/public/catraca/dao/catraca-dao'
import { catracaDeviceIsAliveController } from '@/api/v1/public/catraca/device-is-alive/catraca-device-is-alive'
import { FastifyInstance } from 'fastify'

export async function catracaRoutes(app: FastifyInstance) {
  await app.register(catracaDaoController)
  await app.register(catracaDeviceIsAliveController)
  await app.register(catracaCatraEventController)
}
