// src/models/team/positions/update-supervisor-use-case.ts
import {
  BadRequestErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/infra/errors'
import { getPositionLabel } from '@/models/team/nomination-rules'
import { PgTeamMemberSupervisorsRepository } from '@/repositories/pg/pg-team-member-supervisors-repository'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  PositionType,
  UpdateSupervisorBodyInput,
  UpdateSupervisorParamsInput,
} from '@/schemas/team/positions'
import { FastifyRequest } from 'fastify'

interface Dependencies {
  usersRepository: PgUsersRepository
  teamPositionsRepository: PgTeamPositionsRepository
  teamMemberSupervisorsRepository: PgTeamMemberSupervisorsRepository
}

export interface UpdateSupervisorInput {
  request: FastifyRequest
  params: UpdateSupervisorParamsInput
  data: UpdateSupervisorBodyInput
}

/**
 * Mapeamento de qual posição pode ser chefe imediato de qual
 *
 * Regras:
 * - director: não tem supervisor
 * - supervisor: reporta ao diretor
 * - manager: reporta ao supervisor
 * - assistant_manager: reporta ao gerente
 * - assistant: reporta ao gerente ou subgerente
 */
const ALLOWED_SUPERVISORS: Record<PositionType, PositionType[]> = {
  director: [],
  supervisor: ['director'],
  manager: ['supervisor'],
  assistant_manager: ['manager'],
  assistant: ['manager', 'assistant_manager'],
}

/**
 * Use Case: Atualizar o supervisor de um membro da equipe
 *
 * Regras de negócio:
 * 1. Admin/Dev/Director podem atualizar qualquer supervisor
 * 2. Supervisor pode atualizar supervisor de: manager, assistant_manager, assistant
 * 3. O usuário alvo deve existir no sistema
 * 4. O usuário alvo deve ter uma posição na equipe
 * 5. O supervisor informado deve existir no sistema
 * 6. O supervisor informado deve ter uma posição válida na hierarquia
 * 7. Director não pode ter supervisor
 */
export async function updateSupervisorUseCase(
  { request, params, data }: UpdateSupervisorInput,
  deps: Dependencies,
) {
  const { userId } = params
  const { supervisorEmail } = data

  // 📌 Obtém o usuário que está fazendo a atualização
  const requesterId = request.requestContext.get('userId') as string
  const requesterRole = request.requestContext.get('userRole') as string

  // 📌 Busca a posição do usuário alvo PRIMEIRO (precisamos saber antes de verificar permissões)
  const targetPosition = await deps.teamPositionsRepository.findByUserId(userId)

  if (!targetPosition) {
    throw new NotFoundError({
      message: 'Usuário não possui uma posição na equipe',
      action:
        'Verifique se o usuário está cadastrado na equipe antes de atribuir um supervisor.',
      details: {
        where: 'team.updateSupervisor',
        targetUserId: userId,
        reason: 'position_not_found',
      },
    })
  }

  const targetPositionType = targetPosition.position as PositionType
  const targetPositionLabel = getPositionLabel(targetPositionType)

  // 📌 Busca a posição do solicitante na equipe
  const requesterPosition =
    await deps.teamPositionsRepository.findByUserId(requesterId)
  const requesterPositionType = requesterPosition?.position as
    PositionType | undefined

  // 📌 Verifica se o solicitante pode atualizar supervisores
  // Regras:
  // - Admin/Dev: podem tudo
  // - Director: podem atualizar qualquer posição (exceto director, mas director não tem supervisor)
  // - Supervisor: pode atualizar manager, assistant_manager, assistant
  const isAdminOrDev = ['admin', 'dev'].includes(requesterRole)
  const isDirector = requesterPositionType === 'director'
  const isSupervisor = requesterPositionType === 'supervisor'

  const positionsSupervisorCanUpdate: PositionType[] = [
    'manager',
    'assistant_manager',
    'assistant',
  ]
  const canSupervisorUpdateThisPosition =
    isSupervisor && positionsSupervisorCanUpdate.includes(targetPositionType)

  const hasPermission =
    isAdminOrDev || isDirector || canSupervisorUpdateThisPosition

  if (!hasPermission) {
    throw new ForbiddenError({
      message: 'Você não tem permissão para atualizar supervisores',
      action:
        'Apenas administradores, diretores ou supervisores podem atualizar supervisores.',
      details: {
        where: 'team.updateSupervisor',
        requesterId,
        requesterRole,
        requesterPosition: requesterPositionType,
        targetPosition: targetPositionType,
        reason: 'insufficient_permission',
      },
    })
  }

  // 📌 Verifica se a posição pode ter supervisor
  const allowedSupervisorPositions = ALLOWED_SUPERVISORS[targetPositionType]

  if (allowedSupervisorPositions.length === 0) {
    throw new BadRequestError({
      message: `Um ${targetPositionLabel} não pode ter um chefe imediato na hierarquia`,
      action: `O ${targetPositionLabel} está no topo da hierarquia da equipe e não reporta a ninguém.`,
      details: {
        where: 'team.updateSupervisor',
        targetUserId: userId,
        targetPosition: targetPositionType,
        reason: 'position_cannot_have_supervisor',
      },
    })
  }

  // 📌 Busca o usuário do novo supervisor pelo email
  const supervisorUser = await deps.usersRepository.findByEmail(supervisorEmail)

  if (!supervisorUser) {
    throw new NotFoundError({
      message: 'Supervisor não encontrado',
      action:
        'Verifique se o email do supervisor está correto e se ele está cadastrado no sistema.',
      details: {
        where: 'team.updateSupervisor',
        supervisorEmail,
        reason: 'supervisor_not_found',
      },
    })
  }

  // 📌 Verifica se não está tentando atribuir a si mesmo como supervisor
  // (verificação feita antes da busca de posição para mensagem mais clara)
  if (supervisorUser.id === userId) {
    throw new BadRequestError({
      message: 'Um membro não pode ser seu próprio supervisor',
      action: 'Informe o email de outro membro da equipe como supervisor.',
      details: {
        where: 'team.updateSupervisor',
        targetUserId: userId,
        supervisorUserId: supervisorUser.id,
        reason: 'cannot_be_own_supervisor',
      },
    })
  }

  // 📌 Busca a posição do novo supervisor
  const supervisorPosition = await deps.teamPositionsRepository.findByUserId(
    supervisorUser.id,
  )

  if (!supervisorPosition) {
    throw new BadRequestError({
      message:
        'O usuário informado como supervisor não possui uma posição na equipe',
      action:
        'O supervisor precisa ter uma posição na equipe (diretor, supervisor, gerente ou subgerente).',
      details: {
        where: 'team.updateSupervisor',
        supervisorEmail,
        supervisorUserId: supervisorUser.id,
        reason: 'supervisor_has_no_position',
      },
    })
  }

  // 📌 Verifica se a posição do supervisor é válida para esta hierarquia
  const supervisorPositionType = supervisorPosition.position as PositionType

  if (!allowedSupervisorPositions.includes(supervisorPositionType)) {
    const allowedLabels = allowedSupervisorPositions
      .map((p) => getPositionLabel(p))
      .join(' ou ')
    const supervisorLabel = getPositionLabel(supervisorPositionType)

    throw new BadRequestError({
      message: `Um ${supervisorLabel} não pode ser chefe imediato de um ${targetPositionLabel}`,
      action: `O chefe imediato de um ${targetPositionLabel} deve ser um ${allowedLabels}.`,
      details: {
        where: 'team.updateSupervisor',
        supervisorEmail,
        supervisorPosition: supervisorPositionType,
        targetPosition: targetPositionType,
        allowedSupervisorPositions,
        reason: 'invalid_supervisor_position',
      },
    })
  }

  // 📌 Remove vínculos anteriores do subordinado (se existirem)
  await deps.teamMemberSupervisorsRepository.deleteBySubordinateId(
    targetPosition.id,
  )

  // 📌 Cria o novo vínculo hierárquico
  await deps.teamMemberSupervisorsRepository.create({
    subordinateId: targetPosition.id,
    supervisorId: supervisorPosition.id,
  })

  return {
    message: 'Supervisor atualizado com sucesso',
    userId,
    supervisorUserId: supervisorUser.id,
    supervisorEmail: supervisorUser.email,
    supervisorName: supervisorUser.name,
    supervisorPosition: supervisorPositionType,
  }
}

/**
 * Schema de erros do use case
 */
export const updateSupervisorUseCaseSchema = {
  400: BadRequestErrorSchema,
  403: ForbiddenErrorSchema,
  404: NotFoundErrorSchema,
}
