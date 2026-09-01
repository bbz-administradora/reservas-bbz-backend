/**
 * Migration: Criação da tabela user_outposts
 *
 * Esta tabela armazena os postos avançados dos colaboradores.
 * Um posto avançado representa um colaborador alocado em um cliente externo.
 *
 * Regras de negócio:
 *   - Um usuário pode ter múltiplos postos avançados simultâneos
 *   - Não há restrição de dias duplicados entre postos
 *   - Usuário em posto avançado é isento de todas as regras de reserva
 *   - Para encerrar um posto, seta-se end_date (mantém histórico)
 *
 * Estrutura:
 *   | Campo          | Tipo             | Descrição                            |
 *   |----------------|------------------|--------------------------------------|
 *   | id             | UUID (PK)        | Identificador único                  |
 *   | user_id        | UUID (FK)        | Usuário em posto avançado            |
 *   | client_name    | VARCHAR(255)     | Nome do cliente/posto                |
 *   | client_address | TEXT             | Endereço completo do cliente         |
 *   | start_date     | DATE             | Data de início do posto              |
 *   | end_date       | DATE (nullable)  | Data fim (NULL = indeterminado)      |
 *   | weekdays       | INTEGER[]        | Dias da semana [0-6]                 |
 *   | created_by     | UUID (FK)        | Quem cadastrou o posto               |
 *   | created_at     | TIMESTAMPTZ      | Data de criação                      |
 *   | updated_at     | TIMESTAMPTZ      | Data de atualização                  |
 *
 * Índices:
 *   - idx_user_outposts_user_id: Busca rápida por usuário
 *   - idx_user_outposts_active: Busca de postos ativos
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = function (pgm) {
  pgm.createTable('user_outposts', {
    id: {
      type: 'uuid',
      default: pgm.func('gen_random_uuid()'),
      notNull: true,
      primaryKey: true,
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
      comment: 'Usuário que está em posto avançado',
    },
    client_name: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Nome do cliente/posto onde o usuário está alocado',
    },
    client_address: {
      type: 'text',
      notNull: true,
      comment: 'Endereço completo do cliente',
    },
    start_date: {
      type: 'date',
      notNull: true,
      comment: 'Data de início do posto avançado',
    },
    end_date: {
      type: 'date',
      notNull: false,
      default: null,
      comment: 'Data fim do posto (NULL = indeterminado)',
    },
    weekdays: {
      type: 'integer[]',
      notNull: true,
      comment: 'Dias da semana no posto [0=Dom, 1=Seg, ..., 6=Sáb]',
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'SET NULL',
      comment: 'Usuário que cadastrou o posto avançado',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
    },
  })

  // Índice para busca por usuário
  pgm.createIndex('user_outposts', ['user_id'], {
    name: 'idx_user_outposts_user_id',
  })

  // Índice para busca de postos ativos (start_date <= hoje AND (end_date IS NULL OR end_date >= hoje))
  pgm.createIndex('user_outposts', ['user_id', 'start_date', 'end_date'], {
    name: 'idx_user_outposts_active',
  })

  // Comentário na tabela
  pgm.sql(`
    COMMENT ON TABLE user_outposts IS 'Postos avançados - colaboradores alocados em clientes externos';
  `)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = function (pgm) {
  pgm.dropTable('user_outposts')
}
