import 'dotenv/config'
import express from 'express'
import { connectDB, dbState, disconnectDB } from './configs/db.js'
import { marketRouter } from './routes/market.js'
import { newsRouter } from './routes/news.js'
import { registrationsRouter } from './routes/registrations.js'

const PORT = Number(process.env.PORT) || 5000
const HOST = process.env.HOST || '127.0.0.1'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_req, res) => {
  const db = dbState()
  res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', db })
})

app.use('/api/market', marketRouter)
app.use('/api/news', newsRouter)
app.use('/api/registrations', registrationsRouter)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500)
  if (status >= 500) console.error('[api]', err.message)
  const message = typeof err.expose === 'string' ? err.expose : status < 500 ? 'Bad request' : 'Internal server error'
  res.status(status).json({ error: message })
})

await connectDB()

const server = app.listen(PORT, HOST, () => {
  console.log(`[api] US Bonds API listening on http://${HOST}:${PORT}`)
})

const shutdown = async () => {
  server.close()
  await disconnectDB()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
