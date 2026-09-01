/**
 * Migration para criação das tabelas de monitoramento de usuários
 *
 * Cria duas tabelas relacionadas:
 * 1. user_monitoring: Define quais usuários estão sendo monitorados
 * 2. user_monitoring_logs: Armazena os logs das requisições dos usuários monitorados
 *
 * Uso:
 * - Ativar monitoramento: INSERT INTO user_monitoring (user_id, is_active, reason)
 * - Desativar: UPDATE user_monitoring SET is_active = false WHERE user_id = '...'
 * - Consultar logs: SELECT * FROM user_monitoring_logs WHERE user_id = '...' ORDER BY created_at DESC
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // ========================================
  // Tabela: user_monitoring
  // Define quais usuários estão sendo monitorados
  // ========================================
  pgm.createTable('user_monitoring', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
      comment: 'ID do usuário a ser monitorado',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Se true, o monitoramento está ativo para este usuário',
    },
    reason: {
      type: 'text',
      notNull: false,
      comment:
        'Motivo do monitoramento (ex: bug no check-in, comportamento suspeito)',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
      comment: 'Data de início do monitoramento',
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
      comment: 'Última atualização do registro',
    },
  })

  // Índice único para evitar duplicatas de user_id
  pgm.createIndex('user_monitoring', 'user_id', { unique: true })

  // Índice para buscar usuários ativos rapidamente
  pgm.createIndex('user_monitoring', 'is_active')

  // ========================================
  // Tabela: user_monitoring_logs
  // Armazena os logs das requisições dos usuários monitorados
  // ========================================
  pgm.createTable('user_monitoring_logs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
      comment: 'ID do usuário que fez a requisição',
    },
    user_email: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Email do usuário no momento da requisição',
    },
    user_name: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Nome do usuário no momento da requisição',
    },
    method: {
      type: 'varchar(10)',
      notNull: true,
      comment: 'Método HTTP (GET, POST, PUT, DELETE, etc)',
    },
    url: {
      type: 'text',
      notNull: true,
      comment: 'URL completa da requisição',
    },
    status_code: {
      type: 'integer',
      notNull: false,
      comment: 'Código de status HTTP da resposta',
    },
    request_body: {
      type: 'jsonb',
      notNull: false,
      comment: 'Body da requisição (campos sensíveis são removidos)',
    },
    response_body: {
      type: 'jsonb',
      notNull: false,
      comment: 'Body da resposta (limitado para não estourar o banco)',
    },
    error_name: {
      type: 'varchar(100)',
      notNull: false,
      comment: 'Nome do erro se houve falha',
    },
    error_message: {
      type: 'text',
      notNull: false,
      comment: 'Mensagem do erro',
    },
    error_details: {
      type: 'jsonb',
      notNull: false,
      comment: 'Detalhes adicionais do erro',
    },
    duration_ms: {
      type: 'integer',
      notNull: false,
      comment: 'Tempo de execução da requisição em milissegundos',
    },
    ip: {
      type: 'varchar(45)',
      notNull: false,
      comment: 'IP do cliente (suporta IPv6)',
    },
    user_agent: {
      type: 'text',
      notNull: false,
      comment: 'User-Agent do navegador/cliente',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
      comment: 'Timestamp da requisição',
    },
  })

  // Índice para buscar logs por usuário
  pgm.createIndex('user_monitoring_logs', 'user_id')

  // Índice para buscar logs por data (consultas por período)
  pgm.createIndex('user_monitoring_logs', 'created_at')

  // Índice composto para consultas frequentes (usuário + data)
  pgm.createIndex('user_monitoring_logs', ['user_id', 'created_at'])

  // Índice para filtrar por status de erro
  pgm.createIndex('user_monitoring_logs', 'status_code')

  // Ativa Row-Level Security nas tabelas
  pgm.sql(`ALTER TABLE user_monitoring ENABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE user_monitoring_logs ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Desativa RLS
  pgm.sql(`ALTER TABLE user_monitoring_logs DISABLE ROW LEVEL SECURITY;`)
  pgm.sql(`ALTER TABLE user_monitoring DISABLE ROW LEVEL SECURITY;`)

  // Remove tabela de logs primeiro (tem FK para users)
  pgm.dropTable('user_monitoring_logs')

  // Remove tabela de configuração
  pgm.dropTable('user_monitoring')
}
