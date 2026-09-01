import { FastifyInstance } from 'fastify'

export async function catracaDaoController(app: FastifyInstance) {
  app.post(
    '/v1/public/catraca/dao',
    {
      schema: {
        tags: ['Catraca'],
        operationId: 'catracaDao',
        summary: 'Webhook DAO - iDFace (Control iD)',
        description:
          'Endpoint público para receber eventos DAO da catraca iDFace. Apenas loga o payload recebido.',
      },
    },
    async function handler(request, reply) {
      console.log(
        '🟢🟢🟢[CATRACA][DAO] Payload recebido:',
        JSON.stringify(request.body),
      )
      return reply.status(200).send({ success: true })
    },
  )
}
