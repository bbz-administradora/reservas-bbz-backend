/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Primeiro, desabilitar RLS na tabela spaces
  pgm.sql(`ALTER TABLE spaces DISABLE ROW LEVEL SECURITY;`)

  // Adicionar a coluna qrcode_url na tabela spaces
  pgm.addColumn('spaces', {
    qrcode_url: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'URL do QR code gerado para o espaço',
    },
  })

  // Reabilitar RLS na tabela spaces
  pgm.sql(`ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;`)
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Primeiro, desabilitar RLS na tabela spaces
  pgm.sql(`ALTER TABLE spaces DISABLE ROW LEVEL SECURITY;`)

  // Remover a coluna qrcode_url da tabela spaces
  pgm.dropColumn('spaces', 'qrcode_url')

  // Reabilitar RLS na tabela spaces
  pgm.sql(`ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;`)
}
