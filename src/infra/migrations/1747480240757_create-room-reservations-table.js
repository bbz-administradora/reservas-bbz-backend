/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // extensão necessária para usar GiST em tipos nativos
  pgm.createExtension('btree_gist', { ifNotExists: true })

  pgm.createTable('room_reservations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    room_id: {
      type: 'uuid',
      notNull: true,
      references: 'rooms(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    room_slot_id: {
      type: 'uuid',
      notNull: false,
      references: 'room_slots(id)',
      onDelete: 'SET NULL',
    },
    slot_range: {
      // intervalo de início e fim com timezone
      type: 'tstzrange',
      notNull: true,
    },
    bbz_collaborators: {
      type: 'jsonb',
      notNull: false,
      default: pgm.func(`'[]'::jsonb`),
    },
    external_guests: {
      type: 'jsonb',
      notNull: false,
      default: pgm.func(`'[]'::jsonb`),
    },
    needs_copeira: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'reserved', // reserved | cancelled | closed
    },
    cancelled_by: {
      type: 'uuid',
      references: 'users(id)',
      notNull: false,
      onDelete: 'SET NULL',
    },
    cancel_reason: {
      type: 'text',
      notNull: false,
    },
    cancelled_at: {
      type: 'timestamp with time zone',
      notNull: false,
    },
    closed_at: {
      type: 'timestamp with time zone',
      notNull: false,
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

  pgm.sql(`ALTER TABLE room_reservations ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE room_reservations DISABLE ROW LEVEL SECURITY;`)
  pgm.dropTable('room_reservations')
  pgm.dropExtension('btree_gist', { ifExists: true })
}
