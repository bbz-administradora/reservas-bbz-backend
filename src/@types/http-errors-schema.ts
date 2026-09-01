import z from 'zod'

/**
 * Schema para erros de Requisição Inválida (HTTP 400).
 *
 * Representa um erro onde a requisição possui dados inválidos ou malformados.
 *
 * Propriedades:
 * - name: Nome do erro, fixo como "BadRequestError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para corrigir a requisição.
 * - status_code: Código HTTP fixo 400.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const BadRequestErrorSchema = z
  .object({
    name: z.literal('BadRequestError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que a requisição é inválida.'),
    action: z.string().describe('Ação recomendada para corrigir a requisição.'),
    status_code: z.literal(400).describe('Código de status HTTP 400.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Bad Request errors (HTTP 400)')

/**
 * Schema para erros de Não Autorizado (HTTP 401).
 *
 * Representa um erro onde a autenticação falhou ou não foi fornecida.
 *
 * Propriedades:
 * - name: Nome fixo do erro "UnauthorizedError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para resolver a autenticação.
 * - status_code: Código HTTP fixo 401.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const UnauthorizedErrorSchema = z
  .object({
    name: z.literal('UnauthorizedError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que o acesso não está autorizado.'),
    action: z.string().describe('Ação recomendada para a autenticação.'),
    status_code: z.literal(401).describe('Código de status HTTP 401.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Unauthorized errors (HTTP 401)')

/**
 * Schema para erros de Acesso Proibido (HTTP 403).
 *
 * Representa um erro onde o cliente está autenticado, mas não possui permissão para acessar o recurso.
 *
 * Propriedades:
 * - name: Nome fixo do erro "ForbiddenError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para tentar obter permissão.
 * - status_code: Código HTTP fixo 403.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const ForbiddenErrorSchema = z
  .object({
    name: z.literal('ForbiddenError').describe('Nome fixo do erro.'),
    message: z.string().describe('Mensagem indicando acesso proibido.'),
    action: z.string().describe('Ação recomendada para acessar o recurso.'),
    status_code: z.literal(403).describe('Código de status HTTP 403.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Forbidden errors (HTTP 403)')

/**
 * Schema para erros de Recurso Não Encontrado (HTTP 404).
 *
 * Representa um erro onde o recurso solicitado não foi localizado.
 *
 * Propriedades:
 * - name: Nome fixo do erro "NotFoundError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para quando o recurso não for encontrado.
 * - status_code: Código HTTP fixo 404.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const NotFoundErrorSchema = z
  .object({
    name: z.literal('NotFoundError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que o recurso não foi encontrado.'),
    action: z
      .string()
      .describe('Ação recomendada para o recurso não encontrado.'),
    status_code: z.literal(404).describe('Código de status HTTP 404.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Not Found errors (HTTP 404)')

/**
 * Schema para erros de Método Não Permitido (HTTP 405).
 *
 * Representa um erro onde o método HTTP utilizado não é permitido para o endpoint.
 *
 * Propriedades:
 * - name: Nome fixo do erro "MethodNotAllowedError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para validar o método correto.
 * - status_code: Código HTTP fixo 405.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const MethodNotAllowedErrorSchema = z
  .object({
    name: z.literal('MethodNotAllowedError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que o método HTTP não é permitido.'),
    action: z
      .string()
      .describe('Ação recomendada para corrigir o método HTTP.'),
    status_code: z.literal(405).describe('Código de status HTTP 405.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Method Not Allowed errors (HTTP 405)')

/**
 * Schema para erros de Conflito (HTTP 409).
 *
 * Representa um erro que indica conflito no estado atual do recurso.
 *
 * Propriedades:
 * - name: Nome fixo do erro "ConflictError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para resolver o conflito.
 * - status_code: Código HTTP fixo 409.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const ConflictErrorSchema = z
  .object({
    name: z.literal('ConflictError').describe('Nome fixo do erro.'),
    message: z.string().describe('Mensagem indicando que houve um conflito.'),
    action: z.string().describe('Ação recomendada para resolver o conflito.'),
    status_code: z.literal(409).describe('Código de status HTTP 409.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Conflict errors (HTTP 409)')

/**
 * Schema para erros de Entidade Não Processável (HTTP 422).
 *
 * Representa um erro onde o servidor não consegue processar a requisição por problemas semânticos,
 * normalmente relacionado a validações de dados.
 *
 * Propriedades:
 * - name: Nome fixo do erro "UnprocessableEntityError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para corrigir os dados enviados.
 * - status_code: Código HTTP fixo 422.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const UnprocessableEntityErrorSchema = z
  .object({
    name: z.literal('UnprocessableEntityError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que a entidade não pôde ser processada.'),
    action: z
      .string()
      .describe('Ação recomendada para corrigir os dados enviados.'),
    status_code: z.literal(422).describe('Código de status HTTP 422.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Unprocessable Entity errors (HTTP 422)')

/**
 * Schema para erros de Muitas Requisições (HTTP 429).
 *
 * Representa um erro onde o cliente excedeu o limite de requisições permitidas (rate limiting).
 *
 * Propriedades:
 * - name: Nome fixo do erro "TooManyRequestsError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para reduzir a taxa de requisições.
 * - status_code: Código HTTP fixo 429.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const TooManyRequestsErrorSchema = z
  .object({
    name: z.literal('TooManyRequestsError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que houve muitas requisições.'),
    action: z
      .string()
      .describe('Ação recomendada para reduzir a frequência das requisições.'),
    status_code: z.literal(429).describe('Código de status HTTP 429.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Too Many Requests errors (HTTP 429)')

/**
 * Schema para erros Internos do Servidor (HTTP 500).
 *
 * Representa um erro inesperado no servidor.
 *
 * Propriedades:
 * - name: Nome fixo do erro "InternalServerError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para lidar com o erro.
 * - status_code: Código HTTP fixo 500.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const InternalServerErrorSchema = z
  .object({
    name: z.literal('InternalServerError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando um erro interno no servidor.'),
    action: z
      .string()
      .describe('Ação recomendada para lidar com o erro interno.'),
    status_code: z.literal(500).describe('Código de status HTTP 500.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Internal Server errors (HTTP 500)')

/**
 * Schema para erros de Banco de Dados (HTTP 500).
 *
 * Representa um erro ocorrido durante uma operação no banco de dados.
 *
 * Propriedades:
 * - name: Nome fixo do erro "DatabaseError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada para resolver o problema no banco de dados.
 * - status_code: Código HTTP fixo 500.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const DatabaseErrorSchema = z
  .object({
    name: z.literal('DatabaseError').describe('Nome fixo do erro.'),
    message: z.string().describe('Mensagem indicando erro no banco de dados.'),
    action: z
      .string()
      .describe('Ação recomendada para resolver o problema no banco de dados.'),
    status_code: z.literal(500).describe('Código de status HTTP 500.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema para erros de Banco de Dados (HTTP 500)')

/**
 * Schema para erros de Serviço Indisponível (HTTP 503).
 *
 * Representa um erro onde o serviço está temporariamente indisponível,
 * possivelmente devido a manutenção ou sobrecarga.
 *
 * Propriedades:
 * - name: Nome fixo do erro "ServiceUnavailableError".
 * - message: Mensagem do erro.
 * - action: Ação recomendada enquanto o serviço estiver indisponível.
 * - status_code: Código HTTP fixo 503.
 * - payload: Dados públicos não sensíveis enviados ao cliente (opcional).
 */
export const ServiceUnavailableErrorSchema = z
  .object({
    name: z.literal('ServiceUnavailableError').describe('Nome fixo do erro.'),
    message: z
      .string()
      .describe('Mensagem indicando que o serviço está indisponível.'),
    action: z
      .string()
      .describe('Ação recomendada enquanto o serviço não está disponível.'),
    status_code: z.literal(503).describe('Código de status HTTP 503.'),
    payload: z
      .any()
      .optional()
      .describe('Dados públicos não sensíveis enviados ao cliente.'),
  })
  .describe('Schema to represent Service Unavailable errors (HTTP 503)')
