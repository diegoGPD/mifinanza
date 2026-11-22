import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './db.js'
import authRouter from './auth.js'
import apiRouter from './routes.js'
import quickRouter from './quick.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.set('trust proxy', 1)
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.get('/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/quick', quickRouter)
app.use('/api', apiRouter)

// Manejo de errores de API
app.use('/api', (err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error del servidor' })
})

// Frontend compilado (client/dist)
const dist = path.join(__dirname, '..', 'client', 'dist')
app.use(express.static(dist, { maxAge: '1h', index: false }))
app.get(/.*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))

initDb()
  .then(() => app.listen(PORT, () => console.log(`MiFinanza en http://localhost:${PORT}`)))
  .catch((e) => {
    console.error('Error inicializando DB', e)
    process.exit(1)
  })
