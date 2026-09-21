// Entrada serverless dedicada aos jobs agendados.
//
// Mesma forma de api/index.js e mesmo bundle: o que muda é a configuracao da
// funcao no vercel.json. Job de e-mail processa ate 60 envios a 1/s, o que
// passa do maxDuration default de uma funcao serverless — e elevar esse limite
// na funcao que atende a API publica aplicaria 5 minutos a toda requisicao.
//
// O rewrite de /v1/internal/jobs/(.*) aponta para ca e vem ANTES do catch-all.
const { app } = require('../build/app.js')

let pronto

module.exports = async function handler(req, res) {
  if (!pronto) pronto = app.ready()
  await pronto
  app.server.emit('request', req, res)
}
