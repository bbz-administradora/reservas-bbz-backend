import fastifyBasicAuth from '@fastify/basic-auth'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyRequestContext from '@fastify/request-context'
import fastifySchedule from '@fastify/schedule'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastify, { FastifyReply, FastifyRequest } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import {
  InternalServerErrorSchema,
  UnprocessableEntityErrorSchema,
} from './@types/http-errors-schema'
import { env } from './infra/env'
import { ForbiddenError, UnauthorizedError } from './infra/errors'
import { host } from './infra/hosts'
import { setupJobs } from './infra/jobs'
import { setupErrorHandling } from './middlewares/error-handler'
import { setupUserMonitoring } from './middlewares/user-monitoring'
import { registerRoutes } from './routes'

export const app = fastify()

// Add multipart form data
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// Add CORS
app.register(fastifyCors, {
  origin: (origin, callback) => {
    if (env.NODE_ENV === 'production' && origin) {
      const allowedOrigins = [env.DEVELOPER_IP, host.web, host.webAdmin]

      /* ❗ Em produção, removemos o trecho `!origin` porque não queremos liberar requisições sem header Origin (usado originalmente para permitir mobile apps ou ferramentas CLI que não enviam Origin). Aqui mantemos apenas domínios de browser/PWA definidos em `allowedOrigins`:
        - host.web  (http://localhost:3000 ou domínio de produção)
        - host.webAdmin (http://localhost:3001 ou subdomínio de admin)
      Isso garante que apenas navegadores vindos desses origens possam acessar a API.
      */
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(
          new ForbiddenError({
            message: `💥 Erro de CORS: Origem ${origin} não permitida`,
            action: 'Verifique se a origem da requisição está autorizada.',
          }),
          false,
        )
      }
    } else {
      // In development, allow all origins
      callback(null, true)
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposedHeaders: ['set-cookie'],
})

// Add schema validator and serializer
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// Register basic authentication plugin for API documentation
app.register(fastifyBasicAuth, {
  validate(
    username: string,
    password: string,
    req: FastifyRequest,
    reply: FastifyReply,
    done: () => void,
  ) {
    if (username !== env.API_DOC_USER || password !== env.API_DOC_PASSWORD) {
      throw new UnauthorizedError({
        message: 'Credenciais inválidas.',
        action:
          'Autenticação necessária ou inválida. Verifique suas credenciais e tente novamente.',
      })
    }
    done()
  },
  authenticate: true,
})

// Add hook onRoute to add default error responses
app.addHook('onRoute', (routeOptions) => {
  if (!routeOptions.schema) {
    routeOptions.schema = {}
  }

  routeOptions.schema.response = {
    500: InternalServerErrorSchema,
    ...(routeOptions.schema.response || {}),
  }

  // Adiciona automaticamente o erro 422 se houver params, body ou querystring
  const hasValidationSchemas =
    routeOptions.schema.params ||
    routeOptions.schema.body ||
    routeOptions.schema.querystring

  if (hasValidationSchemas) {
    routeOptions.schema.response = {
      422: UnprocessableEntityErrorSchema,
      ...(routeOptions.schema.response || {}),
    }
  }
})

app.register(async function (app) {
  // Add swagger documentation
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'BBZ App Backend API',
        description: 'API documentation for BBZ App Backend',
        version: '1.0.0',
        contact: {
          name: 'Support',
          email: env.DEVELOPER_EMAIL,
          url: env.DEVELOPER_GITHUB,
        },
      },
      externalDocs: {
        description: 'Repository of project',
        url: env.REPOSITORY_PROJECT_URL,
      },
      servers: [
        {
          url: host.api,
          description:
            env.NODE_ENV === 'production' ? 'Production' : 'Development server',
        },
      ],
      tags: [
        {
          name: 'Auth',
          description: 'Rotas sobre autenticação',
        },
        {
          name: 'Image',
          description: 'Rotas sobre imagens',
        },
        {
          name: 'Infra',
          description: 'Rotas sobre infraestrutura',
        },
        {
          name: 'User',
          description: 'Rotas sobre usuários',
        },
        {
          name: 'Space',
          description: 'Rotas sobre espaços',
        },
        {
          name: 'Space Slot',
          description: 'Rotas sobre horários de espaços',
        },
        {
          name: 'Reservation',
          description: 'Rotas sobre reservas',
        },
        {
          name: 'Team',
          description: 'Rotas sobre equipe de atendimento',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: (data) => {
      const transformed = jsonSchemaTransform(data)

      if (data.url === '/v1/private/image/s3/upload') {
        transformed.schema.body = {
          type: 'object',
          required: ['file'],
          properties: {
            file: {
              type: 'string',
              format: 'binary',
            },
          },
        }
      }

      return transformed
    },
  })

  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiHooks: {
      onRequest: (request, reply, next) => {
        if (env.NODE_ENV !== 'development') {
          return app.basicAuth(request, reply, next)
        }
        next()
      },
    },
  })

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '10m', // Token expires in 10 minutes
      iss: 'bbz-app-backend',
    },
  })

  app.register(fastifyCookie)

  // contexto para pegar userId e userRole do middleware verify-jwt.ts e disponibiliza-lo para toda a aplicação e principalmente em database.ts, assim podemos usar Row Level Security
  app.register(fastifyRequestContext, {
    defaultStoreValues: {
      userId: null as string | null,
      userRole: null as string | null,
      sessionId: null as string | null,
      rememberMe: false, // <== Remember me is false by default
      userAccount: null,
    },
  })

  // Configurar monitoramento de usuários específicos (logs detalhados)
  setupUserMonitoring(app)

  // Register routes
  await registerRoutes(app)

  // Registrar o plugin de agendamento
  app.register(fastifySchedule)

  // Configurar os jobs agendados
  app.ready().then(() => {
    // Configurar e adicionar todos os jobs ao agendador
    setupJobs(app)
  })
})

setupErrorHandling(app)
