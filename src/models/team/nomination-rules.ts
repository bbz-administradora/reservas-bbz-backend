// src/models/team/nomination-rules.ts

import { TeamPositionType } from '@/repositories/base/team-positions-repository'

/**
 * Regras de nomeação na hierarquia da equipe
 *
 * Define quem pode nomear quem baseado em:
 * - roles do sistema (admin, dev, user)
 * - positions da equipe (director, supervisor, manager, etc)
 */

interface NominationRule {
  /** Roles que podem nomear esta posição (admin, dev) */
  allowedRoles: string[]
  /** Positions que podem nomear esta posição */
  allowedPositions: TeamPositionType[]
  /** A quem esta posição reporta (para criar vínculo) */
  reportsTo: TeamPositionType | null
  /** Nível hierárquico */
  level: number
  /** Nome em português para mensagens */
  label: string
  /** Nome em português no plural */
  labelPlural: string
}

/**
 * Mapa de regras de nomeação por posição
 *
 * Hierarquia e permissões de nomeação:
 * - director (1): Nomeado por admin/dev, pode nomear supervisor, manager, assistant_manager, assistant
 * - supervisor (2): Nomeado pelo director, pode nomear manager, assistant_manager, assistant
 * - manager (3): Nomeado pelo director/supervisor, NÃO pode nomear ninguém
 * - assistant_manager (4): Nomeado pelo director/supervisor, NÃO pode nomear ninguém
 * - assistant (5): Nomeado pelo director/supervisor, NÃO pode nomear ninguém
 *
 * Regras simplificadas:
 * - Admin/Dev: podem nomear qualquer posição
 * - Director: pode nomear qualquer posição (exceto director)
 * - Supervisor: pode nomear manager, assistant_manager, assistant
 * - Manager/Assistant Manager/Assistant: NÃO podem nomear ninguém
 */
export const NOMINATION_RULES: Record<TeamPositionType, NominationRule> = {
  director: {
    allowedRoles: ['admin', 'dev'],
    allowedPositions: [],
    reportsTo: null,
    level: 1,
    label: 'Diretor',
    labelPlural: 'Diretores',
  },
  supervisor: {
    allowedRoles: ['admin', 'dev'],
    allowedPositions: ['director'],
    reportsTo: 'director',
    level: 2,
    label: 'Supervisor',
    labelPlural: 'Supervisores',
  },
  manager: {
    allowedRoles: ['admin', 'dev'],
    allowedPositions: ['director', 'supervisor'],
    reportsTo: 'supervisor',
    level: 3,
    label: 'Gerente',
    labelPlural: 'Gerentes',
  },
  assistant_manager: {
    allowedRoles: ['admin', 'dev'],
    allowedPositions: ['director', 'supervisor'],
    reportsTo: 'manager',
    level: 4,
    label: 'Subgerente',
    labelPlural: 'Subgerentes',
  },
  assistant: {
    allowedRoles: ['admin', 'dev'],
    allowedPositions: ['director', 'supervisor'],
    reportsTo: 'manager',
    level: 5,
    label: 'Assistente',
    labelPlural: 'Assistentes',
  },
}

/**
 * Verifica se um usuário pode nomear alguém para uma posição específica
 *
 * @param nominatorRole - Role do usuário que está nomeando (admin, dev, user)
 * @param nominatorPosition - Position do usuário que está nomeando (ou null se não tiver)
 * @param targetPosition - Posição que se deseja nomear
 * @returns true se pode nomear, false caso contrário
 */
export function canNominate(
  nominatorRole: string,
  nominatorPosition: TeamPositionType | null,
  targetPosition: TeamPositionType,
): boolean {
  const rules = NOMINATION_RULES[targetPosition]

  // Verifica se é uma role permitida (admin/dev nomeando director)
  if (rules.allowedRoles.includes(nominatorRole)) {
    return true
  }

  // Verifica se é uma position permitida (director nomeando supervisor)
  if (nominatorPosition && rules.allowedPositions.includes(nominatorPosition)) {
    return true
  }

  return false
}

/**
 * Verifica se um usuário pode remover alguém de uma posição específica
 *
 * Regras:
 * - Quem nomeou pode remover
 * - Superiores na hierarquia podem remover
 * - Admin/Dev podem remover qualquer um
 *
 * @param removerRole - Role do usuário que está removendo
 * @param removerPosition - Position do usuário que está removendo
 * @param targetPosition - Posição que se deseja remover
 * @param wasAssignedByRemover - Se o removedor foi quem nomeou
 * @returns true se pode remover, false caso contrário
 */
export function canRemove(
  removerRole: string,
  removerPosition: TeamPositionType | null,
  targetPosition: TeamPositionType,
  wasAssignedByRemover: boolean,
): boolean {
  // Admin/Dev podem remover qualquer um
  if (['admin', 'dev'].includes(removerRole)) {
    return true
  }

  // Quem nomeou pode remover
  if (wasAssignedByRemover) {
    return true
  }

  // Superior na hierarquia pode remover
  if (removerPosition) {
    const removerLevel = NOMINATION_RULES[removerPosition].level
    const targetLevel = NOMINATION_RULES[targetPosition].level
    return removerLevel < targetLevel
  }

  return false
}

/**
 * Verifica se um usuário pode listar uma posição específica
 *
 * Regras:
 * - Admin/Dev podem listar tudo
 * - Director pode listar tudo
 * - Supervisor pode listar seus gerentes e subordinados
 * - Manager pode listar seus subgerentes e assistentes
 *
 * @param listerRole - Role do usuário que está listando
 * @param listerPosition - Position do usuário que está listando
 * @param targetPosition - Posição que se deseja listar
 * @returns true se pode listar, false caso contrário
 */
export function canList(
  listerRole: string,
  listerPosition: TeamPositionType | null,
  targetPosition: TeamPositionType,
): boolean {
  // Admin/Dev podem listar tudo
  if (['admin', 'dev'].includes(listerRole)) {
    return true
  }

  // Director pode listar tudo
  if (listerPosition === 'director') {
    return true
  }

  // Supervisor pode listar gerentes, subgerentes e assistentes (seus subordinados)
  if (listerPosition === 'supervisor') {
    return ['manager', 'assistant_manager', 'assistant'].includes(
      targetPosition,
    )
  }

  // Manager pode listar subgerentes e assistentes
  if (listerPosition === 'manager') {
    return ['assistant_manager', 'assistant'].includes(targetPosition)
  }

  return false
}

/**
 * Obtém a label (nome em português) de uma posição
 */
export function getPositionLabel(position: TeamPositionType): string {
  return NOMINATION_RULES[position].label
}

/**
 * Obtém a label plural de uma posição
 */
export function getPositionLabelPlural(position: TeamPositionType): string {
  return NOMINATION_RULES[position].labelPlural
}

/**
 * Obtém o nível de uma posição
 */
export function getPositionLevel(position: TeamPositionType): number {
  return NOMINATION_RULES[position].level
}

/**
 * Obtém a posição para a qual uma posição reporta
 */
export function getReportsTo(
  position: TeamPositionType,
): TeamPositionType | null {
  return NOMINATION_RULES[position].reportsTo
}
