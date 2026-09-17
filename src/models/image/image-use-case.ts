// src/models/image/image-use-case.ts
/**
 * Implementação do caso de uso para gerenciamento de imagens.
 *
 * Este arquivo contém as funções de negócio para upload e exclusão de imagens,
 * com armazenamento no S3.
 *
 * O fluxo de trabalho inclui:
 * 1. Autenticação do usuário
 * 2. Validação dos dados de entrada
 * 3. Processamento da imagem
 * 4. Armazenamento ou exclusão no storage
 *
 * @module Image
 */

import { BadRequestErrorSchema } from '@/@types/http-errors-schema'
import { BadRequestError } from '@/infra/errors'
import { IStorageAdapter } from '@/repositories/base/storage-repository'
import { FastifyRequest } from 'fastify'

// Raiz obrigatória de toda chave de imagem no bucket. Imposta pelo servidor,
// nunca pelo cliente.
const PREFIXO_RAIZ = 'images'

/**
 * Rejeita segmento de caminho que possa escapar do prefixo images/ ou
 * produzir chave malformada. Vale para folder, group e subtitle, porque os
 * três entram na composição da chave.
 */
function validarSegmento(
  valor: string | undefined,
  campo: string,
  contexto: Record<string, unknown>,
): void {
  if (valor === undefined) {
    return
  }

  const invalido =
    valor.trim() === '' ||
    valor.startsWith('/') ||
    valor.endsWith('/') ||
    valor.includes('//') ||
    valor.includes('\\') ||
    valor.split('/').some((parte) => parte === '.' || parte === '..')

  if (invalido) {
    throw new BadRequestError({
      message: `Valor inválido para "${campo}"`,
      action:
        'Use apenas nomes simples, sem "..", sem barra no início ou no fim e sem barras duplicadas',
      details: { where: 'image.upload', campo, valor, ...contexto },
    })
  }
}

// Interface para upload de imagem
export interface UploadImageInput {
  request: FastifyRequest
  group: string
  subtitle?: string
  establishmentId?: string
  folder?: string
}

// Interface para delete de imagem
export interface DeleteImageInput {
  request: FastifyRequest
  imagePath: string
}

// Interface de dependências
interface Dependencies {
  storageRepository: IStorageAdapter
}

/**
 * Upload de imagem
 *
 * Esta função lida com o upload de imagens para o storage.
 * A estrutura de armazenamento é organizada da seguinte forma:
 * - Padrão: <folder>/<group>-<subtitle>-<timestamp>.webp
 * - Com establishmentId: <folder>/<establishmentId>/<group>-<subtitle>-<timestamp>.webp
 *
 * Onde:
 * - folder: definido pelo parametro folder (opcional) ou pelo userId extraído do token.
 * - establishmentId: opcional, quando fornecido cria uma subpasta.
 * - group: obrigatório, categoria da imagem (avatar, product, etc).
 * - subtitle: opcional, especifica um subtipo da imagem.
 * - timestamp: gerado automaticamente no formato compacto.
 */
export async function uploadImage(
  { request, group, subtitle, folder }: UploadImageInput,
  deps: Dependencies,
) {
  // 📌 Validar arquivo e grupo
  const file = await request.file()
  if (!file || !group) {
    throw new BadRequestError({
      message: 'Dados inválidos',
      action: 'Envie um arquivo e informe pelo menos o grupo da imagem',
      details: {
        where: 'image.upload',
        hasFile: !!file,
        group,
        subtitle,
        folder,
      },
    })
  }

  // 📌 Validar os segmentos que compõem a chave antes de tocar no storage
  validarSegmento(folder, 'folder', { group, subtitle })
  validarSegmento(group, 'group', { folder, subtitle })
  validarSegmento(subtitle, 'subtitle', { folder, group })

  // 📌 Gerar caminho do arquivo e fazer upload
  let bucketPath: string
  try {
    const buffer = await file.toBuffer()
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '')

    // Determinar a pasta base (userId ou custom folder)
    const baseFolder = folder || null

    // Gerar o nome do arquivo baseado no grupo, subtítulo (se existir) e timestamp
    // Exemplo: "avatar-profile-20230315123045.webp"
    const fileName = `${group}${subtitle ? `-${subtitle}` : ''}-${timestamp}.webp`

    if (baseFolder) {
      // Estrutura: <baseFolder>/<fileName>
      bucketPath = `${baseFolder}/${fileName}`
    } else {
      // Estrutura: <fileName>
      bucketPath = `${fileName}`
    }

    // Salvar na estrutura "images/{bucketPath}"
    const fullPath = `${PREFIXO_RAIZ}/${bucketPath}`

    await deps.storageRepository.uploadFile(fullPath, buffer, 'image/webp')

    // Retorna o caminho completo
    bucketPath = fullPath
  } catch (error) {
    console.error('💥Error processing image:', error)
    throw new BadRequestError({
      message: 'Erro ao processar a imagem',
      action: 'Verifique o arquivo enviado e tente novamente',
      details: {
        where: 'image.upload',
        group,
        subtitle,
        folder,
        originalError: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return {
    imagePath: bucketPath,
    message: 'Imagem enviada com sucesso',
  }
}

/**
 * Delete de imagem
 *
 * Esta função lida com a exclusão de imagens do storage.
 * É necessário fornecer o caminho completo da imagem que será excluída.
 */
export async function deleteImage(
  { request, imagePath }: DeleteImageInput,
  deps: Dependencies,
) {
  // 📌 Validar caminho da imagem
  if (!imagePath) {
    throw new BadRequestError({
      message: 'Caminho da imagem não fornecido',
      action: 'Envie o caminho da imagem a ser excluída',
      details: {
        where: 'image.delete',
        imagePath,
      },
    })
  }

  // 📌 Confinar a exclusão à árvore de imagens. Sem isso, qualquer usuário
  // autenticado consegue apagar qualquer objeto do bucket, inclusive assets
  // estáticos e QR codes.
  if (
    !imagePath.startsWith(`${PREFIXO_RAIZ}/`) ||
    imagePath.split('/').some((parte) => parte === '.' || parte === '..')
  ) {
    throw new BadRequestError({
      message: 'Caminho da imagem inválido',
      action: `O caminho deve começar com "${PREFIXO_RAIZ}/" e não pode conter ".."`,
      details: {
        where: 'image.delete',
        imagePath,
      },
    })
  }

  try {
    await deps.storageRepository.deleteFile(imagePath)
  } catch (error) {
    console.error('💥Error deleting image:', error)
    throw new BadRequestError({
      message: 'Erro ao deletar imagem',
      action: 'Verifique se a imagem existe e tente novamente',
      details: {
        where: 'image.delete',
        imagePath,
        originalError: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return {
    message: 'Imagem deletada com sucesso',
  }
}

// Schemas para documentação da API
export const imageUploadSchema = {
  400: BadRequestErrorSchema,
}

export const imageDeleteSchema = {
  400: BadRequestErrorSchema,
}
