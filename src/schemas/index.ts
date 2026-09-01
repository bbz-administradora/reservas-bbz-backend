import { validateCPF } from '@/utils/cpf'
import { z } from 'zod'

export const fullNameSchema = z
  .string({ required_error: 'O preenchimento do nome é obrigatório.' })
  .trim()
  .min(2, {
    message: 'O preenchimento do nome é obrigatório.',
  })
  .max(100, 'O nome é muito longo.')
  .regex(/^\S+\s+\S+/, {
    message: 'Informe o nome completo com pelo menos um sobrenome.',
  })
  .toLowerCase()

export const emailSchema = z
  .string({ required_error: 'O preenchimento do email é obrigatório.' })
  .trim()
  .toLowerCase()
  .min(3, { message: 'Por favor insira um e-mail válido.' })
  .max(254, 'O e-mail é muito longo.')
  .email({ message: 'E-mail inválido.' })

export const passwordSchema = z
  .string({ required_error: 'A senha é obrigatória.' })
  .min(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  .regex(/[A-Z]/, {
    message: 'A senha deve conter pelo menos uma letra maiúscula.',
  })
  .regex(/[a-z]/, {
    message: 'A senha deve conter pelo menos uma letra minúscula.',
  })
  .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número.' })
  .regex(/[^A-Za-z0-9]/, {
    message: 'A senha deve conter pelo menos um símbolo.',
  })
  .max(100, { message: 'A senha é muito longa.' })

export const cpfSchema = z
  .string()
  .nonempty('CPF é obrigatório')
  .regex(/^\d{11}$/, 'CPF inválido. Deve conter 11 dígitos numéricos.')
  .refine(validateCPF, 'CPF inválido')
  .nullable()
