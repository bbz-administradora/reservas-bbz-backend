import { FastifyInstance } from 'fastify'

export async function catracaDeviceIsAliveController(app: FastifyInstance) {
  app.post(
    '/v1/public/catraca/device_is_alive',
    {
      schema: {
        tags: ['Catraca'],
        operationId: 'catracaDeviceIsAlive',
        summary: 'Webhook Device Is Alive - iDFace (Control iD)',
        description:
          'Endpoint público para receber heartbeat da catraca iDFace. Apenas loga o payload recebido.',
      },
    },
    async function handler(request, reply) {
      console.log(
        '🟢🟢🟢[CATRACA][DEVICE_IS_ALIVE] Payload recebido:',
        JSON.stringify(request.body),
      )
      return reply.status(200).send({ success: true })
    },
  )
}
