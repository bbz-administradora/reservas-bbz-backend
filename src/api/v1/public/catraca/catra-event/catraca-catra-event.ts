import { FastifyInstance } from 'fastify'

export async function catracaCatraEventController(app: FastifyInstance) {
  app.post(
    '/v1/public/catraca/catra_event',
    {
      schema: {
        tags: ['Catraca'],
        operationId: 'catracaCatraEvent',
        summary: 'Webhook Catra Event - iDFace (Control iD)',
        description:
          'Endpoint público para receber eventos da catraca iDFace. Apenas loga o payload recebido.',
      },
    },
    async function handler(request, reply) {
      console.log(
        '🟢🟢🟢[CATRACA][CATRA_EVENT] Payload recebido:',
        JSON.stringify(request.body),
      )
      return reply.status(200).send({ success: true })
    },
  )
}
