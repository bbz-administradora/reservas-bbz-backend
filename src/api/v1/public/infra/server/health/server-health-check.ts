import { serverHealthCheckResponseSchema } from '@/schemas/infra/server-health-check-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function serverHealthCheckController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/public/infra/server/health',
    {
      schema: {
        tags: ['Infra'],
        operationId: 'serverHealthCheck',
        summary: 'Check if the server is healthy',
        description:
          "This endpoint performs a health check on the server. When a GET request is made to '/v1/public/infra/server/health', the server responds with a 200 status code and a message indicating that it is healthy and operational. It is intended for deployment and uptime monitoring.",
        response: {
          200: serverHealthCheckResponseSchema,
        },
      },
    },
    async (request, reply) => {
      return reply.status(200).send({
        message: 'Server is healthy',
      })
    },
  )
}
