import bcryptPass from '@/lib/bcrypt'
import { database } from '../database'

const SEED_PASSWORD = '2TJi#s[AfZO9q[,t'

const users = [
  {
    email: 'dev@bbz.com.br',
    role: 'dev',
    name: 'Dev BBZ',
  },
  {
    email: 'admin@bbz.com.br',
    role: 'admin',
    name: 'Admin BBZ',
  },
]

async function seedUsers() {
  console.log('Iniciando inserção de usuários...')

  for (const userData of users) {
    const existingUser = await database.query({
      text: 'SELECT id FROM users WHERE email = $1 LIMIT 1;',
      values: [userData.email],
    })

    let userId = existingUser.rows[0]?.id

    if (!userId) {
      const passwordHash = await bcryptPass.hash(SEED_PASSWORD)
      const userResult = await database.query({
        text: `
          INSERT INTO users (email, role, name, email_verified, email_verified_provider, password_hash)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id;
        `,
        values: [
          userData.email,
          userData.role,
          userData.name,
          new Date(),
          'credential',
          passwordHash,
        ],
      })

      userId = userResult.rows[0].id
      console.log(`Usuário ${userData.email} criado com sucesso.`)
    }

    await database.query({
      text: `
        INSERT INTO accounts (user_id, type, provider, provider_account_id)
        VALUES
          ($1, 'credential', 'credential', $2),
          ($1, 'google', 'google', $2)
        ON CONFLICT (provider, provider_account_id) DO NOTHING;
      `,
      values: [userId, userId],
    })
  }
}

async function main() {
  try {
    console.log('Executando seed de usuários...')
    await seedUsers()
    console.log('Seed de usuários finalizado com sucesso.')
  } catch (error) {
    console.error('Erro ao executar seed de usuários:', error)
    process.exitCode = 1
  } finally {
    await database.pool.end()
  }
}

void main()
