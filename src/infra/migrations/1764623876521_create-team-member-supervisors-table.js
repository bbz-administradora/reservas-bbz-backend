/**
 * Migration: Criação da tabela team_member_supervisors
 *
 * OBJETIVO:
 * ---------
 * Criar a tabela de relacionamento N:N entre subordinados e seus
 * superiores hierárquicos. Esta tabela permite uma estrutura flexível onde:
 *   - Um supervisor pode estar vinculado ao diretor
 *   - Um gerente pode estar vinculado a um supervisor
 *   - Um subgerente pode estar vinculado a um gerente
 *   - Um assistente pode estar vinculado a um gerente ou subgerente
 *
 * MODELO DE RELACIONAMENTO:
 * -------------------------
 *
 *   ┌──────────────────┐         ┌──────────────────────────────┐
 *   │  team_positions  │         │   team_member_supervisors    │
 *   ├──────────────────┤         ├──────────────────────────────┤
 *   │ id (PK)          │◄────────┤ subordinate_id (FK)          │
 *   │ user_id          │         │ supervisor_id (FK)           │
 *   │ position         │◄────────┤                              │
 *   │ level            │         │ created_at                   │
 *   │ assigned_by      │         │                              │
 *   └──────────────────┘         └──────────────────────────────┘
 *
 * HIERARQUIA E VÍNCULOS:
 * ----------------------
 *
 *   ┌─────────────┐
 *   │  DIRETOR    │ Level 1 - Não é subordinado de ninguém
 *   │  (1)        │
 *   └──────┬──────┘
 *          │
 *          ▼
 *   ┌─────────────┐
 *   │ SUPERVISOR  │ Level 2 - Subordinado do Diretor
 *   │  (~7)       │
 *   └──────┬──────┘
 *          │
 *          ▼
 *   ┌─────────────┐
 *   │  GERENTE    │ Level 3 - Subordinado do Supervisor
 *   │  (~56)      │           (Líder do núcleo)
 *   └──────┬──────┘
 *          │
 *     ┌────┴────┐
 *     ▼         ▼
 * ┌─────────┐ ┌─────────────┐
 * │SUBGEREN.│ │ ASSISTENTE  │ Level 4 e 5 - Subordinados do Gerente
 * │ (~20)   │ │   (~54)     │
 * └─────────┘ └─────────────┘
 *
 * ESTRUTURA DA TABELA:
 * --------------------
 *
 *   | Coluna         | Tipo               | Descrição                           |
 *   |----------------|--------------------|-------------------------------------|
 *   | id             | UUID (PK)          | Identificador único do vínculo      |
 *   | subordinate_id | UUID (FK)          | ID da posição do subordinado        |
 *   | supervisor_id  | UUID (FK)          | ID da posição do superior           |
 *   | created_at     | TIMESTAMP WITH TZ  | Data de criação do vínculo          |
 *
 * REGRAS DE NEGÓCIO:
 * ------------------
 *   1. subordinate_id aponta para um registro em team_positions
 *   2. supervisor_id aponta para um registro em team_positions
 *   3. Um mesmo par (subordinate_id, supervisor_id) não pode se repetir (UNIQUE)
 *   4. Ao deletar uma posição em team_positions, os vínculos são removidos em cascata
 *   5. DIRETOR (level 1) NÃO pode ser subordinado (não aparece em subordinate_id)
 *   6. ASSISTENTE (level 5) NÃO pode ser supervisor (não aparece em supervisor_id)
 *
 * VÍNCULOS PERMITIDOS:
 * --------------------
 *   | Subordinado (subordinate_id) | Superior (supervisor_id)   |
 *   |------------------------------|----------------------------|
 *   | supervisor (level 2)         | director (level 1)         |
 *   | manager (level 3)            | supervisor (level 2)       |
 *   | assistant_manager (level 4)  | manager (level 3)          |
 *   | assistant (level 5)          | manager (level 3)          |
 *   | assistant (level 5)          | assistant_manager (level 4)|
 *
 * EXEMPLOS DE USO:
 * ----------------
 *
 *   -- Vincular supervisor ao diretor
 *   INSERT INTO team_member_supervisors (subordinate_id, supervisor_id)
 *   SELECT
 *     (SELECT id FROM team_positions WHERE user_id = 'uuid-supervisor'),
 *     (SELECT id FROM team_positions WHERE user_id = 'uuid-diretor');
 *
 *   -- Vincular gerente ao supervisor
 *   INSERT INTO team_member_supervisors (subordinate_id, supervisor_id)
 *   SELECT
 *     (SELECT id FROM team_positions WHERE user_id = 'uuid-gerente'),
 *     (SELECT id FROM team_positions WHERE user_id = 'uuid-supervisor');
 *
 *   -- Consultar todos os subordinados de um supervisor/gerente
 *   SELECT
 *     u.name AS subordinado_nome,
 *     u.email AS subordinado_email,
 *     tp.position AS subordinado_posicao,
 *     tp.level AS subordinado_level
 *   FROM team_member_supervisors tms
 *   JOIN team_positions tp ON tp.id = tms.subordinate_id
 *   JOIN users u ON u.id = tp.user_id
 *   WHERE tms.supervisor_id = (
 *     SELECT id FROM team_positions WHERE user_id = 'uuid-do-superior'
 *   );
 *
 *   -- Consultar hierarquia completa (recursiva)
 *   WITH RECURSIVE hierarchy AS (
 *     -- Base: o diretor
 *     SELECT
 *       tp.id,
 *       tp.user_id,
 *       tp.position,
 *       tp.level,
 *       u.name,
 *       NULL::uuid AS supervisor_position_id,
 *       0 AS depth
 *     FROM team_positions tp
 *     JOIN users u ON u.id = tp.user_id
 *     WHERE tp.position = 'director'
 *
 *     UNION ALL
 *
 *     -- Recursão: subordinados
 *     SELECT
 *       tp.id,
 *       tp.user_id,
 *       tp.position,
 *       tp.level,
 *       u.name,
 *       tms.supervisor_id,
 *       h.depth + 1
 *     FROM team_member_supervisors tms
 *     JOIN hierarchy h ON h.id = tms.supervisor_id
 *     JOIN team_positions tp ON tp.id = tms.subordinate_id
 *     JOIN users u ON u.id = tp.user_id
 *   )
 *   SELECT * FROM hierarchy ORDER BY level, name;
 *
 * RELACIONAMENTO COM OUTRAS TABELAS:
 * ----------------------------------
 *   - team_positions: FK em subordinate_id e supervisor_id
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Criar a tabela team_member_supervisors
  pgm.createTable('team_member_supervisors', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
      comment: 'Identificador único do vínculo',
    },
    subordinate_id: {
      type: 'uuid',
      notNull: true,
      references: 'team_positions(id)',
      onDelete: 'CASCADE',
      comment:
        'ID da posição do subordinado (supervisor vinculado a gerente, ou membro vinculado a supervisor/gerente)',
    },
    supervisor_id: {
      type: 'uuid',
      notNull: true,
      references: 'team_positions(id)',
      onDelete: 'CASCADE',
      comment: 'ID da posição do superior hierárquico (gerente ou supervisor)',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func("(now() at time zone 'utc')"),
      comment: 'Data e hora de criação do vínculo',
    },
  })

  // Constraint UNIQUE para evitar vínculos duplicados
  pgm.addConstraint(
    'team_member_supervisors',
    'unique_subordinate_supervisor',
    {
      unique: ['subordinate_id', 'supervisor_id'],
    },
  )

  // Ativar Row-Level Security
  pgm.sql(`ALTER TABLE team_member_supervisors ENABLE ROW LEVEL SECURITY;`)

  // Criar índices para otimização de consultas
  pgm.createIndex('team_member_supervisors', 'subordinate_id', {
    name: 'idx_team_member_supervisors_subordinate_id',
  })

  pgm.createIndex('team_member_supervisors', 'supervisor_id', {
    name: 'idx_team_member_supervisors_supervisor_id',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Remover índices
  pgm.dropIndex('team_member_supervisors', 'subordinate_id', {
    name: 'idx_team_member_supervisors_subordinate_id',
  })

  pgm.dropIndex('team_member_supervisors', 'supervisor_id', {
    name: 'idx_team_member_supervisors_supervisor_id',
  })

  // Remover constraint UNIQUE
  pgm.dropConstraint('team_member_supervisors', 'unique_subordinate_supervisor')

  // Desativar Row-Level Security
  pgm.sql(`ALTER TABLE team_member_supervisors DISABLE ROW LEVEL SECURITY;`)

  // Remover a tabela
  pgm.dropTable('team_member_supervisors')
}
