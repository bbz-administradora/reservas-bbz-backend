/**
 * warning_count:
 *   - Coluna de pontuação para advertências do usuário.
 *   - Cada vez que o usuário não cumpre o ciclo completo de check-in e check-out em uma reserva, recebe um e-mail de advertência e soma +1 ponto.
 *   - Exemplo: Ao atingir 3 pontos, o usuário é banido automaticamente (users.account_status = false).
 *   - O valor máximo para banimento pode ser definido pelo administrador.
 *
 * Ciclo de check-in/check-out de reservas:
 *   - O usuário deve realizar o check-in ao chegar e o check-out ao sair do espaço reservado.
 *   - Se não realizar ambos corretamente, recebe advertência por e-mail e soma ponto em warning_count.
 *   - Ao atingir o limite de advertências, o usuário é bloqueado e precisa procurar o responsável para desbloqueio.
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = function (pgm) {
  pgm.addColumn('users', {
    warning_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Contador de advertências para controle de bloqueio automático',
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = function (pgm) {
  pgm.dropColumn('users', 'warning_count')
}
