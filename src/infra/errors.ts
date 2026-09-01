// src/infra/errors.ts

/**
 * Opções para personalização dos erros.
 *
 * @interface BaseErrorOptions
 * @property {string} [message] - Mensagem descritiva do erro.
 * @property {string} [action] - Ação recomendada para resolução do erro.
 * @property {any} [details] - Detalhes internos de debug (NUNCA enviado ao cliente, apenas para logs no servidor).
 * @property {any} [payload] - Dados públicos não sensíveis que serão enviados ao cliente (ex: campos faltantes, opções válidas).
 */
export interface BaseErrorOptions {
  message?: string
  action?: string
  details?: any
  payload?: any
}

/**
 * Classe base para erros HTTP personalizados.
 *
 * @class BaseError
 * @extends Error
 *
 * @param {number} statusCode - HTTP Status Code do erro.
 * @param {string} defaultMessage - Mensagem padrão do erro.
 * @param {string} defaultAction - Ação padrão recomendada para o erro.
 * @param {BaseErrorOptions} [options] - Opções para sobrescrever os valores padrão.
 */
export class BaseError extends Error {
  public name: string
  public statusCode: number
  public action: string
  public details?: any
  public payload?: any

  constructor(
    statusCode: number,
    defaultMessage: string,
    defaultAction: string,
    options?: BaseErrorOptions,
  ) {
    const message = options?.message ?? defaultMessage
    super(message)
    this.name = new.target.name // Define o nome do erro com o nome da classe
    this.statusCode = statusCode
    this.action = options?.action ?? defaultAction
    this.details = options?.details
    this.payload = options?.payload

    Object.setPrototypeOf(this, new.target.prototype)
  }

  /**
   * Converte o erro para o formato JSON que será enviado ao cliente.
   *
   * ⚠️ IMPORTANTE: O campo `details` é omitido intencionalmente para segurança.
   * Ele contém informações sensíveis de debug que devem ficar apenas nos logs do servidor.
   * Use o campo `payload` para enviar dados não sensíveis ao cliente.
   *
   * @returns {object} Objeto com os detalhes do erro (sem informações sensíveis).
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
      payload: this.payload,
    }
  }
}

/**
 * Erro de Requisição Inválida (HTTP 400).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class BadRequestError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      400,
      'Requisição inválida.',
      'Corrija os dados da requisição.',
      options,
    )
    this.name = 'BadRequestError'
  }
}

/**
 * Erro de Não Autorizado (HTTP 401).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class UnauthorizedError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      401,
      'Não autorizado.',
      'Autenticação necessária ou inválida.',
      options,
    )
    this.name = 'UnauthorizedError'
  }
}

/**
 * Erro de Acesso Proibido (HTTP 403).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class ForbiddenError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      403,
      'Acesso proibido.',
      'Permissão insuficiente para acessar este recurso.',
      options,
    )
    this.name = 'ForbiddenError'
  }
}

/**
 * Erro de Recurso Não Encontrado (HTTP 404).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class NotFoundError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      404,
      'Não encontrado.',
      'O recurso solicitado não foi encontrado.',
      options,
    )
    this.name = 'NotFoundError'
  }
}

/**
 * Erro de Método Não Permitido (HTTP 405).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class MethodNotAllowedError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      405,
      'Método não permitido para este endpoint.',
      'Verifique se o método HTTP enviado é válido para este endpoint.',
      options,
    )
    this.name = 'MethodNotAllowedError'
  }
}

/**
 * Erro de Conflito (HTTP 409).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class ConflictError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(409, 'Conflito.', 'Conflito no estado atual do recurso.', options)
    this.name = 'ConflictError'
  }
}

/**
 * Erro de Entidade Não Processável (HTTP 422).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class UnprocessableEntityError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      422,
      'Entidade não processável.',
      'Dados enviados incorretos ou incompletos.',
      options,
    )
    this.name = 'UnprocessableEntityError'
  }
}

/**
 * Erro de Muitas Requisições (HTTP 429).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class TooManyRequestsError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      429,
      'Muitas requisições.',
      'Aguarde e tente novamente mais tarde.',
      options,
    )
    this.name = 'TooManyRequestsError'
  }
}

/**
 * Erro Interno do Servidor (HTTP 500).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class InternalServerError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      500,
      'Erro interno do servidor.',
      'Erro inesperado no servidor.',
      options,
    )
    this.name = 'InternalServerError'
  }
}

/**
 * Erro no Banco de Dados (HTTP 500).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class DatabaseError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      500,
      'Erro no banco de dados.',
      'Verifique a conexão, os parâmetros da query e os logs do servidor para mais detalhes.',
      options,
    )
    this.name = 'DatabaseError'
  }
}

/**
 * Erro de Serviço Indisponível (HTTP 503).
 *
 * Permite personalizar a mensagem, a ação e os detalhes, mantendo valores padrão se não fornecidos.
 */
export class ServiceUnavailableError extends BaseError {
  constructor(options?: BaseErrorOptions) {
    super(
      503,
      'Serviço indisponível.',
      'O serviço está temporariamente indisponível.',
      options,
    )
    this.name = 'ServiceUnavailableError'
  }
}
