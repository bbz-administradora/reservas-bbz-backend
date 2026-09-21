import { database } from '@/infra/database'
import { env } from '@/infra/env'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '@/infra/errors'
import { isJobName } from '@/infra/jobs/registry'
import { executarJob } from '@/infra/jobs/runner'
import {
  jobsRunBodySchema,
  jobsRunParamsSchema,
  jobsRunResponseSchema,
} from '@/schemas/internal/jobs-run-schema'
import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { timingSafeEqual } from 'node:crypto'

/**
 * Comparação em tempo constante, para não vazar o segredo por medida de tempo.
 *
 * O tamanho diferente sai antes porque `timingSafeEqual` exige buffers iguais.
 * Isso revela o comprimento do segredo, o que é aceito: o que protege é ele ter
 * no mínimo 32 caracteres, não o comprimento ser desconhecido.
 */
function segredoConfere(recebido: unknown): boolean {
  if (typeof recebido !== 'string' || recebido.length === 0) {
    return false
  }

  const enviado = Buffer.from(recebido)
  const esperado = Buffer.from(env.JOBS_TRIGGER_SECRET)

  if (enviado.length !== esperado.length) {
    return false
  }

  return timingSafeEqual(enviado, esperado)
}

/**
 * Rota interna de execução de job, chamada pelo `pg_net` a mando do pg_cron.
 *
 * Não tem JWT, não tem CSRF e não aparece no Swagger: a autenticação é o
 * segredo compartilhado, que vive no Vault do lado do banco e em variável de
 * ambiente do lado da API.
 *
 * Quem decide o horário é o pg_cron. Quem decide se esta execução pode
 * acontecer é o ledger: `jobs.claim_run` só deixa passar uma vez por disparo,
 * então reentrega do mesmo gatilho vira 409 em vez de execução dupla.
 */
export async function jobsRunController(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/v1/internal/jobs/:name',
    {
      schema: {
        hide: true,
        operationId: 'internalJobsRun',
        summary: 'Executa um job agendado (uso interno do pg_cron)',
        params: jobsRunParamsSchema,
        body: jobsRunBodySchema,
        response: {
          200: jobsRunResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!segredoConfere(request.headers['x-jobs-secret'])) {
        throw new UnauthorizedError({
          message: 'Segredo do gatilho ausente ou inválido.',
          action: 'Esta rota é de uso interno e não deve ser chamada à mão.',
        })
      }

      const { name } = request.params

      if (!isJobName(name)) {
        throw new NotFoundError({
          message: `Job "${name}" não existe no registry.`,
          action:
            'Confira se o nome em jobs.job_definition bate com a chave do registry.',
        })
      }

      const { runId, timeoutMs } = request.body

      if (runId) {
        const reclamada = await database.query({
          text: 'SELECT jobs.claim_run($1, $2) AS ok',
          values: [runId, name],
        })

        if (!reclamada.rows[0]?.ok) {
          // A execução não estava em `dispatched`: ou já foi reclamada, ou já
          // terminou. Nos dois casos, executar de novo seria duplicar.
          throw new ConflictError({
            message: `Execução ${runId} já foi reclamada.`,
            action: 'Nenhuma ação necessária: o gatilho chegou duas vezes.',
          })
        }
      } else if (env.NODE_ENV === 'production') {
        throw new BadRequestError({
          message: 'Execução sem runId não é permitida em produção.',
          action:
            "Para rodar na mão, use select jobs.trigger_http('<nome>', 'manual') — assim a execução entra no histórico.",
        })
      }

      const inicio = Date.now()

      try {
        const resultado = await executarJob({
          name,
          log: request.log,
          timeoutMs,
        })

        if (runId) {
          await database.query({
            text: 'SELECT jobs.finish_run($1, $2, $3::jsonb, $4)',
            values: [
              runId,
              resultado.status,
              JSON.stringify(resultado.stats),
              null,
            ],
          })
        }

        return reply.status(200).send({
          job: name,
          runId: runId ?? null,
          status: resultado.status,
          durationMs: Date.now() - inicio,
          stats: resultado.stats,
        })
      } catch (error) {
        // O ledger é a fonte de verdade, então ele precisa saber da falha antes
        // de a resposta sair. Se nem isso funcionar, o watchdog pega a execução
        // pendurada em `running` e a marca como falha em até 5 minutos.
        if (runId) {
          await database
            .query({
              text: 'SELECT jobs.finish_run($1, $2, $3::jsonb, $4)',
              values: [
                runId,
                'failed',
                '{}',
                error instanceof Error ? error.message : String(error),
              ],
            })
            .catch(() => undefined)
        }

        throw error
      }
    },
  )
}
