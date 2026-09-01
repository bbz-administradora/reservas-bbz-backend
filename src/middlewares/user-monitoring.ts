// src/middlewares/user-monitoring.ts
import { PgUserMonitoringRepository } from '@/repositories/pg/pg-user-monitoring-repository'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * Middleware de monitoramento de usuários específicos.
 *
 * Intercepta todas as requisições e loga detalhes completos no BANCO DE DADOS
 * para usuários configurados na tabela user_monitoring.
 *
 * O monitoramento captura:
 * - Timestamp da requisição
 * - Método HTTP e URL
 * - Headers relevantes (IP, User-Agent)
 * - Body da requisição
 * - Body da resposta
 * - Código de status
 * - Tempo de execução
 * - Erros (se houver)
 *
 * Como usar:
 * 1. Ativar monitoramento:
 *    INSERT INTO user_monitoring (user_id, reason) VALUES ('uuid-do-usuario', 'Bug no check-in');
 *
 * 2. Consultar logs:
 *    SELECT * FROM user_monitoring_logs WHERE user_id = 'uuid' ORDER BY created_at DESC;
 *
 * 3. Desativar:
 *    UPDATE user_monitoring SET is_active = false WHERE user_id = 'uuid';
 */
export function setupUserMonitoring(app: FastifyInstance): void {
  // Instância do repositório (reutilizada em todas as requisições)
  const monitoringRepository = new PgUserMonitoringRepository()

  // Armazena dados temporários da requisição
  const requestStartTimes = new Map<string, number>()
  const requestBodies = new Map<string, unknown>()
  const monitoredRequests = new Map<string, boolean>()

  // Hook onRequest - Captura no início da requisição
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const requestId = request.id
    requestStartTimes.set(requestId, Date.now())
  })

  // Hook preHandler - Captura após parsing do body e autenticação
  app.addHook('preHandler', async (request: FastifyRequest) => {
    const requestId = request.id
    const userId = request.requestContext?.get('userId') as string | undefined

    // Se temos userId, verifica se está sendo monitorado
    if (userId) {
      try {
        const isMonitored = await monitoringRepository.isUserMonitored(userId)
        monitoredRequests.set(requestId, isMonitored)

        if (isMonitored && request.body) {
          // Salva o body para logging posterior (sanitizado)
          const sanitizedBody = sanitizeBody(request.body)
          requestBodies.set(requestId, sanitizedBody)
        }
      } catch {
        // Se falhar a verificação, não monitora (não quebra a aplicação)
        monitoredRequests.set(requestId, false)
      }
    }
  })

  // Hook onResponse - Captura após envio da resposta
  app.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id
      const userId = request.requestContext?.get('userId') as string | undefined

      // Só loga se o usuário estiver sendo monitorado
      const isMonitored = monitoredRequests.get(requestId)
      if (!userId || !isMonitored) {
        // Limpa dados temporários
        cleanupRequestData(requestId)
        return
      }

      // Calcula duração
      const startTime = requestStartTimes.get(requestId)
      const duration = startTime ? Date.now() - startTime : undefined

      // Obtém dados do contexto
      const userAccount = request.requestContext?.get('userAccount') as
        { email?: string; name?: string } | undefined

      // Salva log no banco de dados
      try {
        await monitoringRepository.createLog({
          userId,
          userEmail: userAccount?.email,
          userName: userAccount?.name,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          requestBody: requestBodies.get(requestId),
          durationMs: duration,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        })

        // Log visual no console também (útil para debug em tempo real)
        const emoji = reply.statusCode >= 400 ? '⚠️' : '✅'
        console.log(
          `${emoji} [MONITOR] ${userAccount?.name || userId} | ${request.method} ${request.url} | ${reply.statusCode} | ${duration}ms`,
        )
      } catch (err) {
        console.error('⚠️ [MONITOR] Erro ao salvar log:', err)
      }

      // Limpa dados temporários
      cleanupRequestData(requestId)
    },
  )

  // Hook onError - Captura erros antes do error handler
  app.addHook(
    'onError',
    async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const requestId = request.id
      const userId = request.requestContext?.get('userId') as string | undefined

      // Só loga se o usuário estiver sendo monitorado
      const isMonitored = monitoredRequests.get(requestId)
      if (!userId || !isMonitored) {
        return
      }

      // Calcula duração
      const startTime = requestStartTimes.get(requestId)
      const duration = startTime ? Date.now() - startTime : undefined

      // Obtém dados do contexto
      const userAccount = request.requestContext?.get('userAccount') as
        { email?: string; name?: string } | undefined

      // Salva log de erro no banco de dados
      try {
        await monitoringRepository.createLog({
          userId,
          userEmail: userAccount?.email,
          userName: userAccount?.name,
          method: request.method,
          url: request.url,
          statusCode: (error as any).statusCode || 500,
          requestBody: requestBodies.get(requestId),
          errorName: error.name,
          errorMessage: error.message,
          errorDetails: (error as any).details,
          durationMs: duration,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        })

        // Log visual no console
        console.log(
          `❌ [MONITOR] ${userAccount?.name || userId} | ${request.method} ${request.url} | ERROR: ${error.name} - ${error.message}`,
        )
      } catch (err) {
        console.error('⚠️ [MONITOR] Erro ao salvar log de erro:', err)
      }

      // Nota: NÃO limpamos os dados aqui pois o onResponse ainda será chamado
    },
  )

  // Função auxiliar para limpar dados temporários
  function cleanupRequestData(requestId: string): void {
    requestStartTimes.delete(requestId)
    requestBodies.delete(requestId)
    monitoredRequests.delete(requestId)
  }

  console.log(
    '🔍 [USER-MONITOR] Sistema de monitoramento de usuários ativado (banco de dados)',
  )
}

/**
 * Remove campos sensíveis do body antes de logar
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body
  }

  const sensitiveFields = [
    'password',
    'senha',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'credit_card',
    'creditCard',
    'cvv',
  ]

  const sanitized = { ...body } as Record<string, unknown>

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}
