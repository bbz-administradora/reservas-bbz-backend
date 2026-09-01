/**
 * booking_exception_until:
 *   - Coluna para armazenar a data/hora até quando a exceção de regras de reserva é válida.
 *   - Quando preenchida com data futura, libera o usuário de certas validações de reserva.
 *   - NULL ou data passada = sem exceção ativa (validações normais se aplicam).
 *
 * O que a exceção libera (semana vigente):
 *   - Fazer reserva na sexta-feira
 *   - Fazer reserva na semana atual
 *   - Ignora limite de dias (2-3 por cargo)
 *   - Ignora segunda/sexta obrigatória
 *   - MANTÉM validação de uma reserva de workstation por dia
 *
 * Quem pode conceder:
 *   - Admin/Dev: qualquer usuário com posição em time
 *   - Diretor: qualquer usuário com posição em time
 *   - Supervisor: apenas membros da própria equipe
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = function (pgm) {
  pgm.addColumn('users', {
    booking_exception_until: {
      type: 'timestamp with time zone',
      notNull: false,
      default: null,
      comment:
        'Data/hora limite da exceção de regras de reserva concedida por supervisor/admin/diretor. NULL = sem exceção.',
    },
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = function (pgm) {
  pgm.dropColumn('users', 'booking_exception_until')
}
