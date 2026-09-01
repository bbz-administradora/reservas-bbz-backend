/**
 * Migration: Criação da tabela team_positions
 *
 * OBJETIVO:
 * ---------
 * Criar a tabela que armazena as posições/cargos dos usuários na hierarquia
 * da equipe de atendimento. Esta tabela permite a gestão de diretores,
 * supervisores, gerentes, subgerentes e assistentes de forma flexível e escalável.
 *
 * HIERARQUIA DA EQUIPE:
 * ---------------------
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    ADMIN / DEV (role)                          │
 *   │                 Pode nomear o DIRETOR                          │
 *   └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    DIRETOR (position)                          │
 *   │  Level 1 │ Único no sistema │ Nomeia SUPERVISORES              │
 *   └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                   SUPERVISOR (position)                        │
 *   │  Level 2 │ ~7 no sistema │ ~5 núcleos cada │ Nomeia GERENTES   │
 *   └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                                 ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    GERENTE (position)                          │
 *   │  Level 3 │ ~56 no sistema │ Líder do núcleo                    │
 *   │  Nomeia SUBGERENTES e ASSISTENTES                              │
 *   └─────────────────────────────────────────────────────────────────┘
 *                                 │
 *                    ┌────────────┴────────────┐
 *                    ▼                         ▼
 *   ┌─────────────────────────────┐ ┌─────────────────────────────────┐
 *   │   SUBGERENTE (position)     │ │     ASSISTENTE (position)       │
 *   │  Level 4 │ ~20 no sistema   │ │  Level 5 │ ~54 no sistema       │
 *   │  Braço direito do Gerente   │ │  Base da equipe                 │
 *   └─────────────────────────────┘ └─────────────────────────────────┘
 *
 * COMPOSIÇÕES VÁLIDAS DE NÚCLEO:
 * ------------------------------
 *   • Gerente + Subgerente + Assistente(s)
 *   • Gerente + Subgerente
 *   • Gerente + Assistente(s)
 *   • Gerente sozinho
 *
 * ESTRUTURA DA TABELA:
 * --------------------
 *
 *   | Coluna       | Tipo                  | Descrição                              |
 *   |--------------|-----------------------|----------------------------------------|
 *   | id           | UUID (PK)             | Identificador único da posição         |
 *   | user_id      | UUID (FK, UNIQUE)     | Usuário que possui a posição           |
 *   | position     | ENUM                  | director, supervisor, manager,         |
 *   |              |                       | assistant_manager, assistant           |
 *   | level        | INTEGER               | Nível hierárquico (1-5)                |
 *   | assigned_by  | UUID (FK)             | Quem nomeou esta pessoa                |
 *   | created_at   | TIMESTAMP WITH TZ     | Data de criação                        |
 *   | updated_at   | TIMESTAMP WITH TZ     | Data de atualização                    |
 *
 * NÍVEIS HIERÁRQUICOS:
 * --------------------
 *   | Level | Position          | Quantidade | Pode nomear              |
 *   |-------|-------------------|------------|--------------------------|
 *   | 1     | director          | 1          | supervisor               |
 *   | 2     | supervisor        | ~7         | manager                  |
 *   | 3     | manager           | ~56        | assistant_manager,       |
 *   |       |                   |            | assistant                |
 *   | 4     | assistant_manager | ~20        | -                        |
 *   | 5     | assistant         | ~54        | -                        |
 *
 * REGRAS DE NEGÓCIO:
 * ------------------
 *   1. Um usuário pode ter apenas UMA posição (user_id é UNIQUE)
 *   2. Apenas UM diretor é permitido no sistema
 *   3. A remoção de uma posição transforma o usuário em "usuário comum"
 *   4. Usuários com role 'dev' não devem ser adicionados à equipe
 *   5. Apenas usuários com conta ativa podem ser nomeados
 *   6. O level é derivado automaticamente da position
 *
 * EXEMPLOS DE USO:
 * ----------------
 *
 *   -- Nomear um diretor (feito pelo Admin/Dev)
 *   INSERT INTO team_positions (user_id, position, level, assigned_by)
 *   VALUES ('uuid-do-usuario', 'director', 1, 'uuid-do-admin');
 *
 *   -- Nomear um supervisor (feito pelo Diretor)
 *   INSERT INTO team_positions (user_id, position, level, assigned_by)
 *   VALUES ('uuid-do-usuario', 'supervisor', 2, 'uuid-do-diretor');
 *
 *   -- Nomear um gerente (feito pelo Supervisor)
 *   INSERT INTO team_positions (user_id, position, level, assigned_by)
 *   VALUES ('uuid-do-usuario', 'manager', 3, 'uuid-do-supervisor');
 *
 *   -- Nomear um subgerente (feito pelo Gerente)
 *   INSERT INTO team_positions (user_id, position, level, assigned_by)
 *   VALUES ('uuid-do-usuario', 'assistant_manager', 4, 'uuid-do-gerente');
 *
 *   -- Nomear um assistente (feito pelo Gerente)
 *   INSERT INTO team_positions (user_id, position, level, assigned_by)
 *   VALUES ('uuid-do-usuario', 'assistant', 5, 'uuid-do-gerente');
 *
 *   -- Consultar todos os supervisores
 *   SELECT u.name, u.email, tp.level, tp.created_at
 *   FROM team_positions tp
 *   JOIN users u ON u.id = tp.user_id
 *   WHERE tp.position = 'supervisor';
 *
 *   -- Consultar todos com alta regalia (level <= 2)
 *   SELECT u.name, u.email, tp.position, tp.level
 *   FROM team_positions tp
 *   JOIN users u ON u.id = tp.user_id
 *   WHERE tp.level <= 2;
 *
 *   -- Remover posição de um usuário (volta a ser usuário comum)
 *   DELETE FROM team_positions WHERE user_id = 'uuid-do-usuario';
 *
 * RELACIONAMENTO COM OUTRAS TABELAS:
 * ----------------------------------
 *   - users: FK em user_id e assigned_by
 *   - team_member_supervisors: Tabela de relacionamento N:N (próxima migration)
 *   - check_in_rules: Regras de check-in por position (migration futura)
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Criar o tipo ENUM para as posições da equipe (5 níveis hierárquicos)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_position_type') THEN
        CREATE TYPE "team_position_type" AS ENUM (
          'director',           -- Level 1: Diretor (único)
          'supervisor',         -- Level 2: Supervisor (~7)
          'manager',            -- Level 3: Gerente de núcleo (~56)
          'assistant_manager',  -- Level 4: Subgerente (~20)
          'assistant'           -- Level 5: Assistente (~54)
        );
      END IF;
    END
    $$;
  `)

  // Criar a tabela team_positions
  pgm.createTable('team_positions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Identificador único da posição',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
      comment: 'Usuário que possui esta posição (único por usuário)',
    },
    position: {
      type: 'team_position_type',
      notNull: true,
      comment:
        'Tipo da posição: director, supervisor, manager, assistant_manager, assistant',
    },
    level: {
      type: 'integer',
      notNull: true,
      comment:
        'Nível hierárquico (1=director, 2=supervisor, 3=manager, 4=assistant_manager, 5=assistant)',
    },
    assigned_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'SET NULL',
      comment: 'Usuário que nomeou esta pessoa para a posição',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
      comment: 'Data e hora de criação do registro',
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
      comment: 'Data e hora da última atualização',
    },
  })

  // Constraint CHECK para garantir que o level corresponde à position
  pgm.sql(`
    ALTER TABLE team_positions
    ADD CONSTRAINT chk_position_level CHECK (
      (position = 'director' AND level = 1) OR
      (position = 'supervisor' AND level = 2) OR
      (position = 'manager' AND level = 3) OR
      (position = 'assistant_manager' AND level = 4) OR
      (position = 'assistant' AND level = 5)
    );
  `)

  // Ativar Row-Level Security
  pgm.sql(`ALTER TABLE team_positions ENABLE ROW LEVEL SECURITY;`)

  // Criar índices para otimização de consultas
  pgm.createIndex('team_positions', 'user_id', {
    name: 'idx_team_positions_user_id',
  })

  pgm.createIndex('team_positions', 'position', {
    name: 'idx_team_positions_position',
  })

  pgm.createIndex('team_positions', 'level', {
    name: 'idx_team_positions_level',
  })

  pgm.createIndex('team_positions', 'assigned_by', {
    name: 'idx_team_positions_assigned_by',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Remover índices
  pgm.dropIndex('team_positions', 'user_id', {
    name: 'idx_team_positions_user_id',
  })

  pgm.dropIndex('team_positions', 'position', {
    name: 'idx_team_positions_position',
  })

  pgm.dropIndex('team_positions', 'level', {
    name: 'idx_team_positions_level',
  })

  pgm.dropIndex('team_positions', 'assigned_by', {
    name: 'idx_team_positions_assigned_by',
  })

  // Remover constraint CHECK
  pgm.sql(
    `ALTER TABLE team_positions DROP CONSTRAINT IF EXISTS chk_position_level;`,
  )

  // Desativar Row-Level Security
  pgm.sql(`ALTER TABLE team_positions DISABLE ROW LEVEL SECURITY;`)

  // Remover a tabela
  pgm.dropTable('team_positions')

  // Remover o tipo ENUM
  pgm.sql(`DROP TYPE IF EXISTS team_position_type;`)
}
