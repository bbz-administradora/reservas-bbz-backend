import { userAbsenceController } from '@/api/v1/private/user/absence/user-absence'
import { userCreateController } from '@/api/v1/private/user/create/user-create'
import { userDeleteController } from '@/api/v1/private/user/delete/user-delete'
import { userGetController } from '@/api/v1/private/user/get/user-get'
import { grantBookingExceptionController } from '@/api/v1/private/user/grant-booking-exception/grant-booking-exception'
import { userListController } from '@/api/v1/private/user/list/user-list'
import { userMeController } from '@/api/v1/private/user/me/user-me'
import { userUpdateController } from '@/api/v1/private/user/update/user-update'
import { FastifyInstance } from 'fastify'

export async function userRoutes(app: FastifyInstance) {
  app.register(userMeController)
  app.register(userCreateController)
  app.register(userDeleteController)
  app.register(userGetController)
  app.register(userUpdateController)
  app.register(userListController)
  app.register(grantBookingExceptionController)
  app.register(userAbsenceController)
}
