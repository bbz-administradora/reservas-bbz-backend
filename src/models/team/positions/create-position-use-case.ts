// src/models/team/positions/create-position-use-case.ts
import {
  BadRequestErrorSchema,
  ConflictErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/infra/errors'
import { canNominate, getPositionLabel } from '@/models/team/nomination-rules'
import { PgTeamPositionsRepository } from '@/repositories/pg/pg-team-positions-repository'
import { PgUsersRepository } from '@/repositories/pg/pg-users-repository'
import {
  CreatePositionBodyInput,
  CreatePositionParamsInput,
  PositionType,
} from '@/schemas/team/positions'
import { sendEmail } from '@/utils/email'
import { FastifyRequest } from 'fastify'

interface Dependencies {
  usersRepository: PgUsersRepository
  teamPositionsRepository: PgTeamPositionsRepository
}

export interface CreatePositionInput {
  request: FastifyRequest
  params: CreatePositionParamsInput
  data: CreatePositionBodyInput
}

/**
 * Posições que OBRIGATORIAMENTE precisam informar o chefe imediato (supervisorEmail)
 */
const REQUIRES_SUPERVISOR: PositionType[] = [
  'manager',
  'assistant_manager',
  'assistant',
]

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
 * Use Case: Criar uma posição na equipe de atendimento
 *
 * Regras de negócio:
 * 1. Verificar permissão de nomeação baseado na hierarquia
 * 2. O usuário alvo deve existir no sistema
 * 3. O usuário alvo deve ter conta ativa
 * 4. O usuário alvo não pode ter role 'dev'
 * 5. O usuário alvo não pode já ter uma posição na equipe
 * 6. Para manager/assistant_manager/assistant, o chefe imediato (supervisorEmail) é obrigatório
 * 7. O chefe imediato deve ter uma posição válida na hierarquia
 */
export async function createPositionUseCase(
  { request, params, data }: CreatePositionInput,
  deps: Dependencies,
) {
  const { position } = params
  const { email, supervisorEmail } = data
  const positionLabel = getPositionLabel(position)

  // 📌 Obtém o usuário que está fazendo a nomeação
  const assignedById = request.requestContext.get('userId') as string
  const assignerRole = request.requestContext.get('userRole') as string

  // 📌 Busca a posição do nomeador (pode não ter)
  const assignerPosition =
    await deps.teamPositionsRepository.findByUserId(assignedById)
  const assignerPositionType = assignerPosition?.position as
    PositionType | undefined

  // 📌 Verifica se o nomeador pode criar esta posição
  if (!canNominate(assignerRole, assignerPositionType ?? null, position)) {
    throw new ForbiddenError({
      message: `Você não tem permissão para nomear um ${positionLabel}`,
      action: `Verifique as regras de hierarquia. ${getPermissionHint(position)}`,
      details: {
        where: 'team.createPosition',
        assignerId: assignedById,
        assignerRole,
        assignerPosition: assignerPositionType ?? null,
        targetPosition: position,
        reason: 'insufficient_permission_to_nominate',
      },
    })
  }

  // 📌 Verifica se o chefe imediato é obrigatório para esta posição
  const requiresSupervisor = REQUIRES_SUPERVISOR.includes(position)
  const allowedSupervisorPositions = ALLOWED_SUPERVISORS[position]

  if (requiresSupervisor && !supervisorEmail) {
    const allowedLabels = allowedSupervisorPositions
      .map((p) => getPositionLabel(p))
      .join(' ou ')

    throw new BadRequestError({
      message: `O email do chefe imediato é obrigatório para nomear um ${positionLabel}`,
      action: `Informe o email do ${allowedLabels} que será o chefe imediato deste ${positionLabel}.`,
      details: {
        where: 'team.createPosition',
        targetPosition: position,
        allowedSupervisorPositions,
        reason: 'supervisor_email_required',
      },
    })
  }

  // 📌 Valida o chefe imediato (se informado)
  let supervisorPositionId: string | null = null

  if (supervisorEmail) {
    // Busca o usuário do chefe pelo email
    const supervisorUser =
      await deps.usersRepository.findByEmail(supervisorEmail)

    if (!supervisorUser) {
      throw new NotFoundError({
        message: 'Chefe imediato não encontrado',
        action:
          'Verifique se o email do chefe imediato está correto e se ele está cadastrado no sistema.',
        details: {
          where: 'team.createPosition',
          supervisorEmail,
          targetPosition: position,
          reason: 'supervisor_not_found',
        },
      })
    }

    // Busca a posição do chefe
    const supervisorPosition = await deps.teamPositionsRepository.findByUserId(
      supervisorUser.id,
    )

    if (!supervisorPosition) {
      throw new BadRequestError({
        message:
          'O usuário informado como chefe imediato não possui uma posição na equipe',
        action:
          'O chefe imediato precisa ter uma posição na equipe (supervisor, gerente ou subgerente).',
        details: {
          where: 'team.createPosition',
          supervisorEmail,
          supervisorUserId: supervisorUser.id,
          targetPosition: position,
          reason: 'supervisor_has_no_position',
        },
      })
    }

    // Verifica se a posição do chefe é válida para esta nomeação
    const supervisorPositionType = supervisorPosition.position as PositionType

    if (!allowedSupervisorPositions.includes(supervisorPositionType)) {
      const allowedLabels = allowedSupervisorPositions
        .map((p) => getPositionLabel(p))
        .join(' ou ')
      const supervisorLabel = getPositionLabel(supervisorPositionType)

      throw new BadRequestError({
        message: `Um ${supervisorLabel} não pode ser chefe imediato de um ${positionLabel}`,
        action: `O chefe imediato de um ${positionLabel} deve ser um ${allowedLabels}.`,
        details: {
          where: 'team.createPosition',
          supervisorEmail,
          supervisorPosition: supervisorPositionType,
          targetPosition: position,
          allowedSupervisorPositions,
          reason: 'invalid_supervisor_position',
        },
      })
    }

    supervisorPositionId = supervisorPosition.id
  }

  // 📌 Busca o usuário alvo (que será nomeado) pelo email
  const targetUser = await deps.usersRepository.findByEmail(email)

  if (!targetUser) {
    throw new NotFoundError({
      message: 'Usuário não encontrado',
      action:
        'Verifique se o email está correto e se o usuário está cadastrado no sistema.',
      details: {
        where: 'team.createPosition',
        targetEmail: email,
        targetPosition: position,
      },
    })
  }

  // 📌 Verifica se a conta do usuário alvo está ativa
  if (!targetUser.accountStatus) {
    throw new ForbiddenError({
      message: 'Não é possível nomear um usuário com conta inativa',
      action: `Ative a conta do usuário antes de nomeá-lo ${positionLabel}.`,
      details: {
        where: 'team.createPosition',
        targetUserId: targetUser.id,
        accountStatus: targetUser.accountStatus,
        targetPosition: position,
        reason: 'account_inactive',
      },
    })
  }

  // 📌 Verifica se o usuário alvo é dev (não pode ser nomeado)
  if (targetUser.role === 'dev') {
    throw new ForbiddenError({
      message: 'Usuários com perfil "dev" não podem ser nomeados para a equipe',
      action: 'Selecione um usuário com perfil "admin" ou "user".',
      details: {
        where: 'team.createPosition',
        targetUserId: targetUser.id,
        targetUserRole: targetUser.role,
        targetPosition: position,
        reason: 'dev_cannot_be_nominated',
      },
    })
  }

  // 📌 Verifica se o usuário alvo já tem uma posição
  const existingPosition = await deps.teamPositionsRepository.findByUserId(
    targetUser.id,
  )

  if (existingPosition) {
    throw new ConflictError({
      message: `Este usuário já possui a posição de "${getPositionLabel(existingPosition.position as PositionType)}" na equipe`,
      action:
        'Remova a posição atual antes de atribuir uma nova, ou escolha outro usuário.',
      details: {
        where: 'team.createPosition',
        targetUserId: targetUser.id,
        existingPositionId: existingPosition.id,
        existingPosition: existingPosition.position,
        targetPosition: position,
        reason: 'user_already_has_position',
      },
    })
  }

  // 📌 Busca dados do nomeador (para o email)
  const assignedByUser = await deps.usersRepository.findById(assignedById)

  // 📌 Cria a posição com o vínculo hierárquico correto
  const createdPosition = await deps.teamPositionsRepository.create({
    userId: targetUser.id,
    position,
    assignedBy: assignedById,
    supervisorPositionId, // Passa o ID da posição do chefe imediato (pode ser null)
  })

  // 📌 Envia email de notificação para o novo membro
  await sendEmail({
    type: 'TEAM_NOMINATION',
    data: {
      userName: targetUser.name || targetUser.email,
      positionLabel,
      assignedByName: assignedByUser?.name || assignedByUser?.email || 'Admin',
    },
    to: targetUser.email,
    userId: targetUser.id,
  })

  return {
    position: {
      id: createdPosition.id,
      userId: createdPosition.userId,
      type: position,
      level: createdPosition.level,
      userName: targetUser.name,
      userEmail: targetUser.email,
      createdAt: createdPosition.createdAt,
    },
    message: `${targetUser.name || targetUser.email} foi nomeado(a) ${positionLabel} da equipe de atendimento`,
  }
}

/**
 * Retorna dica de permissão para a mensagem de erro
 */
function getPermissionHint(position: PositionType): string {
  const hints: Record<PositionType, string> = {
    director: 'Apenas administradores podem nomear Diretores.',
    supervisor:
      'Apenas Diretores ou administradores podem nomear Supervisores.',
    manager: 'Apenas Diretores ou Supervisores podem nomear Gerentes.',
    assistant_manager:
      'Apenas Diretores ou Supervisores podem nomear Subgerentes.',
    assistant: 'Apenas Diretores ou Supervisores podem nomear Assistentes.',
  }
  return hints[position]
}

export const createPositionUseCaseSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
  403: ForbiddenErrorSchema,
  409: ConflictErrorSchema,
}
