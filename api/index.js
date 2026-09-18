// Entrada serverless da Vercel.
//
// Aponta para o bundle do tsup (build/), nao para o fonte. O preset "fastify"
// da Vercel transpila src/ arquivo a arquivo e deixa `require("@/...")` literal
// no .js emitido: o alias `@/*` do tsconfig so existe em tempo de build, e o
// Node nao resolve em runtime. Dai o `Cannot find module '@/utils/email'`.
// O bundle do tsup ja resolveu os 740 imports com `@/` — e e o mesmo artefato
// que o Render publica, entao os dois ambientes rodam o mesmo codigo.
const { app } = require('../build/app.js')

let pronto

module.exports = async function handler(req, res) {
  if (!pronto) pronto = app.ready()
  await pronto
  app.server.emit('request', req, res)
}
