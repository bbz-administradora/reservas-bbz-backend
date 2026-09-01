// src/models/space/space-qrcode-use-case.ts
import {
  BadRequestErrorSchema,
  NotFoundErrorSchema,
} from '@/@types/http-errors-schema'
import { BadRequestError, NotFoundError } from '@/infra/errors'
import { host } from '@/infra/hosts'
import { PgSpacesRepository } from '@/repositories/pg/pg-spaces-repository'
import { S3StorageAdapter } from '@/repositories/s3/s3-storage-repository'
import {
  SpaceQrcodeParamsInput,
  SpaceQrcodeResponse,
} from '@/schemas/space/space-qrcode-schema'
import QRCode from 'qrcode'

interface InputProps {
  data: SpaceQrcodeParamsInput
}

interface Dependencies {
  spaceRepository: PgSpacesRepository
  storageRepository: S3StorageAdapter
}

export async function spaceQrcodeUseCase(
  input: InputProps,
  deps: Dependencies,
): Promise<SpaceQrcodeResponse> {
  const { spaceId } = input.data
  const { spaceRepository, storageRepository } = deps

  // Verificar se o espaço existe
  const space = await spaceRepository.findById(spaceId)
  if (!space) {
    throw new NotFoundError({
      message: 'Espaço não encontrado',
      action: 'Verifique o ID do espaço informado e tente novamente',
      details: {
        where: 'space.qrcode',
        spaceId,
      },
    })
  }

  // Verificar se o QR code já existe
  if (space.qrcodeUrl) {
    return {
      qrcodeUrl: space.qrcodeUrl,
      message: 'QR Code já existente recuperado com sucesso',
    }
  }

  // Se não existir, geramos um novo QR code
  try {
    // Definir o caminho do arquivo no S3
    const qrcodePath = `images/espacos/qrcode/qrcode-espaco-bbz-${spaceId}.png`

    // Gerar a URL do frontend para o espaço
    const spaceUrl = `${host.webAdmin}/espacos/check-in-out/${spaceId}`

    // Gerar o QR code como um buffer
    const qrCodeBuffer = await QRCode.toBuffer(spaceUrl, {
      type: 'png',
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'H',
    })

    // Fazer upload do QR code para o S3
    await storageRepository.uploadFile(qrcodePath, qrCodeBuffer, 'image/png')

    // Atualizar a URL do QR code no banco de dados
    const updatedSpace = await spaceRepository.updateQrcodeUrl(
      spaceId,
      qrcodePath,
    )

    return {
      qrcodeUrl: updatedSpace.qrcodeUrl || qrcodePath,
      message: 'QR Code gerado com sucesso',
    }
  } catch (error) {
    console.error('Erro ao gerar QR code:', error)
    throw new BadRequestError({
      message: 'Erro ao gerar QR Code para o espaço',
      action: 'Tente novamente mais tarde',
      details: {
        where: 'space.qrcode',
        spaceId,
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

export const spaceQrcodeUseCaseSchema = {
  400: BadRequestErrorSchema,
  404: NotFoundErrorSchema,
}
