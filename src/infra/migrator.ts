import { join } from 'node:path'
import { database } from './database'
import { DatabaseError } from './errors'

const defaultConfigurations = {
  migrationsTable: 'pgmigrations',
  dryRun: true, // This will not run the migrations, just show what would be run
  dir: join(process.cwd(), 'src', 'infra', 'migrations'), // Work in all systems
  direction: 'up' as const,
  verbose: false, // This will not log the migration process
  log: () => {}, // This will not log the migration process
}

/**
 * Lista as migrações pendentes.
 *
 * @returns Lista de migrações pendentes.
 * @throws {DatabaseError} Em caso de erro ao listar as migrações.
 */
async function listPendingMigrations() {
  const databaseClient = await database.getNewClientWithOutPool()
  try {
    const { runner: migrationRunner } = await import('node-pg-migrate')
    const pendingMigrations = await migrationRunner({
      ...defaultConfigurations,
      dbClient: databaseClient,
    })
    return pendingMigrations
  } catch (error) {
    console.error('💥 Error listing pending migrations', error)
    throw new DatabaseError({
      action:
        'Erro ao listar as migrações pendentes. Verifique a configuração do banco de dados e os logs de migração.',
    })
  } finally {
    await databaseClient?.end()
  }
}

/**
 * Executa as migrações pendentes.
 *
 * @returns Lista de migrações executadas.
 * @throws {DatabaseError} Em caso de erro ao executar as migrações.
 */
async function runPendingMigrations() {
  const databaseClient = await database.getNewClientWithOutPool()
  try {
    const { runner: migrationRunner } = await import('node-pg-migrate')
    const migratedMigrations = await migrationRunner({
      ...defaultConfigurations,
      dbClient: databaseClient,
      dryRun: false,
    })
    return migratedMigrations
  } catch (error) {
    console.error('💥 Error running pending migrations', error)
    throw new DatabaseError({
      action:
        'Erro ao executar as migrações pendentes. Verifique a configuração do banco de dados e os logs de migração.',
    })
  } finally {
    await databaseClient?.end()
  }
}

const migrator = {
  listPendingMigrations,
  runPendingMigrations,
}

export default migrator
