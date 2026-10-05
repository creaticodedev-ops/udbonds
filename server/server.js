import 'dotenv/config'
import express from 'express'
import { connectDB, dbState, disconnectDB } from './configs/db.js'

const PORT = Number(process.env.PORT) || 5000
const HOST = process.env.HOST || '127.0.0.1'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_req, res) => {
  const db = dbState()
  res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', db })
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((err, _req, res, _next) => {
  console.error('[api]', err)
  res.status(500).json({ error: 'Internal server error' })
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
