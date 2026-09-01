import { createOAuth2Client } from '@/lib/google/clientFactory'
import { loginUserGoogleResponseSchema } from '@/schemas/auth/login-user-google-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function loginGoogleController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/v1/public/auth/login/google',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'loginUserGoogle',
        summary: 'Iniciar autenticação com Google',
        description:
          'Redireciona o usuário para a página de login do Google com escopos de Calendar',
        response: {
          302: loginUserGoogleResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const oauth2Client = createOAuth2Client()

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'openid',
          'email',
          'profile',
          // 'https://www.googleapis.com/auth/calendar.events', // Escopo sensível para acesso ao Google Calendar
          // Caso futuramente seja necessário manipular eventos do Google Calendar via API, basta remover o comentário acima.
          // Atualmente, optamos por não solicitar este escopo sensível para evitar o processo de aprovação do Google, que pode ser demorado e exigir verificação adicional.
          // Como estamos apenas enviando arquivos .ics para o usuário importar manualmente, a autenticação básica já é suficiente.
        ],
      })

      return reply.status(302).redirect(authUrl)
    },
  )
}
