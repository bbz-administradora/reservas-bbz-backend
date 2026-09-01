import { BaseError } from '@/infra/errors'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * Middleware global de tratamento de erros para Fastify.
 *
 * Registra o erro completo (incluindo stacktrace e details) no console do servidor para debug,
 * mas retorna uma resposta padronizada para o cliente, sem expor detalhes internos.
 *
 * 🔒 SEGURANÇA:
 * - Campo `details`: Apenas logado no servidor (informações sensíveis de debug)
 * - Campo `payload`: Enviado ao cliente (apenas dados públicos e seguros)
 * - Stacktrace: Nunca enviado ao cliente
 *
 * A resposta ao cliente segue o formato:
 * {
 *   name: string,
 *   message: string,
 *   action: string,
 *   status_code: number,
 *   payload?: any
 * }
 *
 * @param error - Erro ocorrido durante a execução.
 * @param request - Objeto de requisição do Fastify.
 * @param reply - Objeto de resposta do Fastify.
 * @returns Resposta HTTP com o erro padronizado.
 */
export async function globalErrorHandler(
  error: any,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Evita logar erros esperados e comuns no fluxo normal da aplicação para não poluir os logs.
  // Exemplos de erros silenciados:
  // - UnauthorizedError: Ocorre durante o refresh de token (a cada 10 minutos) ou quando o token JWT expira naturalmente
  // - ValidationError: Erros de validação são esperados quando o usuário envia dados incorretos
  // Esses erros são retornados ao cliente normalmente, mas não aparecem no console do servidor.
  const shouldSilenceLog =
    error instanceof BaseError &&
    (error.name === 'UnauthorizedError' || error.name === 'ValidationError')

  if (!shouldSilenceLog) {
    // Loga o erro completo no servidor, incluindo stacktrace e details (informações sensíveis)
    console.error('🚨 Error Details (Server Only):', {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details, // ⚠️ Informações sensíveis (IDs, localização no código, etc.)
      payload: error.payload, // ℹ️ Dados públicos que serão enviados ao cliente
      stack: error.stack,
    })
  }

  // Se o erro for uma instância de BaseError, utiliza seu método toJSON para retornar o objeto padronizado.
  // O método toJSON automaticamente remove o campo `details` e o stacktrace da resposta.
  if (error instanceof BaseError) {
    return reply.status(error.statusCode).send(error.toJSON())
  }

  // Erro de validação do Fastify (ex: Zod)
  if (error.code === 'FST_ERR_VALIDATION') {
    const firstIssue =
      error.validation?.[0]?.message || 'Entidade não processável.'

    // Detecta especificamente o erro de ausência do Content-Type JSON
    if (
      error.validationContext === 'body' &&
      firstIssue.includes('Expected object, received string')
    ) {
      const response = {
        name: 'BadRequestError',
        message:
          "O corpo da requisição não é um JSON válido. Provavelmente faltou o header 'Content-Type: application/json'.",
        action:
          "Adicione o header 'Content-Type: application/json' na sua requisição e tente novamente.",
        status_code: 400,
        payload: undefined,
      }
      return reply.status(400).send(response)
    }

    // Tratamento padrão para outros erros de validação (schema Zod)
    const response = {
      name: 'UnprocessableEntityError',
      message: firstIssue,
      action: 'Dados enviados incorretos ou incompletos.',
      status_code: 422,
      payload: undefined,
    }
    return reply.status(422).send(response)
  }

  // Erro de autenticação básica do Fastify (Basic Auth)
  if (error.code === 'FST_BASIC_AUTH_MISSING_OR_BAD_AUTHORIZATION_HEADER') {
    const response = {
      name: 'UnauthorizedError',
      message: 'Não autorizado.',
      action: 'Autenticação necessária ou inválida.',
      status_code: 401,
      payload: undefined,
    }
    return reply.status(401).send(response)
  }

  // Para todos os outros erros, retorna uma mensagem genérica padronizada
  const response = {
    name: 'InternalServerError',
    message: 'Erro interno do servidor.',
    action: 'Erro inesperado no servidor.',
    status_code: 500,
    payload: undefined,
  }
  return reply.status(500).send(response)
}

/**
 * Configura o middleware global de tratamento de erros na instância do Fastify.
 *
 * @param app - Instância do Fastify.
 */
export function setupErrorHandling(app: FastifyInstance) {
  app.setErrorHandler(globalErrorHandler)
}
