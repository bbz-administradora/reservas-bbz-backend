// src/models/team/organogram/get-organogram-use-case.ts
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import {
  GetOrganogramResponse,
  OrganogramMember,
} from '@/schemas/team/organogram'

interface Dependencies {
  teamPositionsRepository: PgTeamPositionsRepository
}

/**
 * Use Case: Buscar o organograma completo da equipe
 *
 * Retorna a árvore hierárquica com todos os membros e suas relações,
 * começando pelos diretores até os assistentes.
 *
 * Regras de negócio:
 * 1. Busca todas as posições com seus vínculos hierárquicos
 * 2. Monta a árvore recursivamente (pai → filhos)
 * 3. Ordena subordinados por nome em cada nível
 * 4. Calcula estatísticas por posição
 */
export async function getOrganogramUseCase(
  deps: Dependencies,
): Promise<GetOrganogramResponse> {
  // 📌 Busca todas as posições com seus vínculos hierárquicos
  const positions = await deps.teamPositionsRepository.listForOrganogram()

  // 📌 Contadores por posição
  const stats = {
    total: positions.length,
    byPosition: {
      director: 0,
      supervisor: 0,
      manager: 0,
      assistant_manager: 0,
      assistant: 0,
    },
  }

  // 📌 Mapa de id -> membro (para montar a árvore)
  const membersMap = new Map<string, OrganogramMember>()

  // 📌 Primeiro passo: criar todos os membros
  for (const row of positions) {
    stats.byPosition[row.position]++

    const member: OrganogramMember = {
      id: row.id,
      userId: row.userId,
      position: row.position,
      level: row.level,
      userName: row.userName,
      userEmail: row.userEmail,
      subordinates: [],
      subordinatesCount: 0,
    }

    membersMap.set(row.id, member)
  }

  // 📌 Segundo passo: montar as relações pai-filho
  const rootMembers: OrganogramMember[] = []

  for (const row of positions) {
    const member = membersMap.get(row.id)!

    if (row.supervisorPositionId) {
      // Tem um supervisor - adiciona como subordinado dele
      const supervisor = membersMap.get(row.supervisorPositionId)
      if (supervisor) {
        supervisor.subordinates.push(member)
        supervisor.subordinatesCount++
      } else {
        // Supervisor não encontrado, trata como raiz
        rootMembers.push(member)
      }
    } else {
      // Não tem supervisor - é raiz (director)
      rootMembers.push(member)
    }
  }

  // 📌 Ordena subordinados por nome em cada nível
  function sortSubordinates(member: OrganogramMember): void {
    member.subordinates.sort((a, b) => {
      const nameA = a.userName || ''
      const nameB = b.userName || ''
      return nameA.localeCompare(nameB, 'pt-BR')
    })

    for (const sub of member.subordinates) {
      sortSubordinates(sub)
    }
  }

  for (const root of rootMembers) {
    sortSubordinates(root)
  }

  return {
    tree: rootMembers,
    stats,
    message:
      stats.total > 0
        ? `Organograma com ${stats.total} membro(s)`
        : 'Nenhum membro na equipe ainda',
  }
}

export const getOrganogramUseCaseSchema = {}
