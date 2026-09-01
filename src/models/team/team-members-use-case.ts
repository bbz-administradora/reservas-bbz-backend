// src/models/team/team-members-use-case.ts
import { NotFoundErrorSchema } from '@/@types/http-errors-schema'
import { ITeamMemberSupervisorsRepository } from '@/repositories/base/team-member-supervisors-repository'
import { ITeamPositionsRepository } from '@/repositories/base/team-positions-repository'
import { TeamMembersResponse } from '@/schemas/team/team-members-schema'

export interface TeamMembersInput {
  /** Dados do usuário autenticado que está fazendo a requisição */
  requestUser: {
    id: string
    role: 'dev' | 'admin' | 'user'
    teamPosition:
      | 'director'
      | 'supervisor'
      | 'manager'
      | 'assistant_manager'
      | 'assistant'
      | null
  }
}

interface Dependencies {
  teamPositionsRepository: ITeamPositionsRepository
  teamMemberSupervisorsRepository: ITeamMemberSupervisorsRepository
}

/**
 * Lista os membros da equipe com base nas permissões do usuário:
 * - Admin/Dev: Todos os usuários com posição em time (exceto supervisor e diretor)
 * - Diretor: Todos os usuários com posição em time (exceto supervisor e diretor)
 * - Supervisor: Apenas subordinados da própria equipe
 */
export async function teamMembersUseCase(
  input: TeamMembersInput,
  deps: Dependencies,
): Promise<TeamMembersResponse> {
  const { requestUser } = input

  interface MemberData {
    userId: string
    name: string | null
    email: string
    position:
      'director' | 'supervisor' | 'manager' | 'assistant_manager' | 'assistant'
    bookingExceptionUntil: string | null
  }

  let members: MemberData[] = []

  // Admin/Dev ou Diretor: todos os usuários com posição em time
  if (
    ['admin', 'dev'].includes(requestUser.role) ||
    requestUser.teamPosition === 'director'
  ) {
    // Listar todas as posições (já inclui bookingExceptionUntil e accountStatus)
    const allPositions = await deps.teamPositionsRepository.listForOrganogram()

    // Filtrar: apenas contas ativas e excluir supervisor/diretor
    members = allPositions
      .filter(
        (pos) =>
          pos.accountStatus &&
          pos.position !== 'director' &&
          pos.position !== 'supervisor',
      )
      .map((pos) => ({
        userId: pos.userId,
        name: pos.userName,
        email: pos.userEmail,
        position: pos.position,
        bookingExceptionUntil: pos.bookingExceptionUntil,
      }))
  }
  // Supervisor: apenas subordinados da própria equipe
  else if (requestUser.teamPosition === 'supervisor') {
    // Buscar a posição do supervisor
    const supervisorPosition = await deps.teamPositionsRepository.findByUserId(
      requestUser.id,
    )

    if (supervisorPosition) {
      // Buscar TODOS os subordinados recursivamente (toda a árvore hierárquica)
      const subordinates =
        await deps.teamMemberSupervisorsRepository.listAllSubordinatesRecursive(
          supervisorPosition.id,
        )

      // Buscar todas as posições para obter bookingExceptionUntil
      const allPositions =
        await deps.teamPositionsRepository.listForOrganogram()

      // Criar mapa de userId -> posição para lookup rápido
      const positionMap = new Map(allPositions.map((pos) => [pos.userId, pos]))

      // Mapear subordinados com dados de exceção
      members = subordinates
        .filter((sub) => {
          const pos = positionMap.get(sub.subordinateUserId)
          return pos?.accountStatus !== false
        })
        .map((sub) => {
          const pos = positionMap.get(sub.subordinateUserId)
          return {
            userId: sub.subordinateUserId,
            name: sub.subordinateUserName,
            email: sub.subordinateUserEmail,
            position: sub.subordinatePosition,
            bookingExceptionUntil: pos?.bookingExceptionUntil ?? null,
          }
        })
    }
  }

  // Ordenar por nome
  members.sort((a, b) => {
    const nameA = a.name || a.email
    const nameB = b.name || b.email
    return nameA.localeCompare(nameB, 'pt-BR')
  })

  return {
    members,
    total: members.length,
    message:
      members.length > 0
        ? `${members.length} membro(s) encontrado(s)`
        : 'Nenhum membro encontrado',
  }
}

export const teamMembersUseCaseSchema = {
  404: NotFoundErrorSchema,
}
