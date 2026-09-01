// src/routes/imageRoutes.ts
import { imageDeleteController } from '@/api/v1/private/image/s3/delete/image-delete'
import { imageUploadController } from '@/api/v1/private/image/s3/upload/image-upload'
import { FastifyInstance } from 'fastify'

export async function imageRoutes(app: FastifyInstance) {
  app.register(imageUploadController)
  app.register(imageDeleteController)
}
