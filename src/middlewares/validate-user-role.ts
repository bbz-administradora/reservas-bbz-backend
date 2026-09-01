// src/middlewares/validate-user-role.ts
import {
  ForbiddenErrorSchema,
  UnauthorizedErrorSchema,
} from '@/@types/http-errors-schema'
import { ForbiddenError, UnauthorizedError } from '@/infra/errors'
import { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Factory that returns an async hook for Fastify.
 * Throws UnauthorizedError if role check fails.
 */
export function validateUserRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // get user role from request context
    const userRole = request.requestContext.get('userRole')

    if (!userRole) {
      throw new UnauthorizedError({
        message: 'Acesso não autorizado',
        action: 'Faça login para continuar',
        details: {
          where: 'middleware.validateUserRole',
          reason: 'missing_user_role',
        },
      })
    }

    if (!roles.includes(userRole)) {
      throw new ForbiddenError({
        message: 'Acesso não autorizado para este recurso',
        action: 'Você não tem permissão para acessar este recurso',
        details: {
          where: 'middleware.validateUserRole',
          userRole,
          allowedRoles: roles,
          reason: 'role_not_allowed',
        },
      })
    }
  }
}

export const validateUserRoleSchema = {
  401: UnauthorizedErrorSchema,
  403: ForbiddenErrorSchema,
}
