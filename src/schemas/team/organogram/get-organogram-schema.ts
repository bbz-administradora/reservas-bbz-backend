// src/schemas/team/organogram/get-organogram-schema.ts
import z from 'zod'

/**
 * Schema recursivo para um membro do organograma
 *
 * Cada membro possui seus dados básicos e uma lista de subordinados,
 * formando uma árvore hierárquica.
 */
const organogramMemberSchema: z.ZodType<OrganogramMember> = z.lazy(() =>
  z.object({
    id: z
      .string()
      .uuid()
      .describe(
        'Identificador único da posição no formato UUID v4. Campo obrigatório.',
      ),
    userId: z
      .string()
      .uuid()
      .describe(
        'Identificador único do usuário no formato UUID v4. Campo obrigatório.',
      ),
    position: z
      .enum([
        'director',
        'supervisor',
        'manager',
        'assistant_manager',
        'assistant',
      ])
      .describe(
        'Tipo da posição na hierarquia. Valores: director, supervisor, manager, assistant_manager, assistant. Campo obrigatório.',
      ),
    level: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe(
        'Nível hierárquico da posição (1=director até 5=assistant). Campo obrigatório.',
      ),
    userName: z
      .string()
      .nullable()
      .describe('Nome do membro. Pode ser nulo se não definido.'),
    userEmail: z
      .string()
      .email()
      .describe('E-mail do membro. Campo obrigatório.'),
    subordinates: z
      .array(z.lazy(() => organogramMemberSchema))
      .describe('Lista de subordinados diretos deste membro.'),
    subordinatesCount: z
      .number()
      .int()
      .min(0)
      .describe('Quantidade de subordinados diretos.'),
  }),
)

/**
 * Tipo do membro do organograma
 */
export interface OrganogramMember {
  id: string
  userId: string
  position:
    'director' | 'supervisor' | 'manager' | 'assistant_manager' | 'assistant'
  level: number
  userName: string | null
  userEmail: string
  subordinates: OrganogramMember[]
  subordinatesCount: number
}

/**
 * Schema para estatísticas do organograma
 */
const organogramStatsSchema = z.object({
  total: z
    .number()
    .int()
    .min(0)
    .describe('Total de membros na equipe. Campo obrigatório.'),
  byPosition: z
    .object({
      director: z.number().int().min(0).describe('Quantidade de diretores.'),
      supervisor: z
        .number()
        .int()
        .min(0)
        .describe('Quantidade de supervisores.'),
      manager: z.number().int().min(0).describe('Quantidade de gerentes.'),
      assistant_manager: z
        .number()
        .int()
        .min(0)
        .describe('Quantidade de subgerentes.'),
      assistant: z.number().int().min(0).describe('Quantidade de assistentes.'),
    })
    .describe('Quantidade de membros por posição.'),
})

/**
 * Schema para a resposta do endpoint GET /team/organogram
 */
export const getOrganogramResponseSchema = z
  .object({
    tree: z
      .array(organogramMemberSchema)
      .describe(
        'Árvore hierárquica da equipe. Começa pelos diretores e desce até os assistentes.',
      ),
    stats: organogramStatsSchema.describe('Estatísticas gerais da equipe.'),
    message: z
      .string()
      .describe('Mensagem de sucesso da operação. Campo obrigatório.'),
  })
  .describe('Resposta do endpoint de organograma da equipe.')

/**
 * Tipos inferidos do schema
 */
export type GetOrganogramResponse = z.infer<typeof getOrganogramResponseSchema>
