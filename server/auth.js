import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { q } from './db.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiame'
const COOKIE = 'mf_token'
const isProd = process.env.NODE_ENV === 'production'

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  maxAge: 30 * 24 * 3600 * 1000,
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE]
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Sesión inválida' })
  }
}

const router = Router()

router.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido' })
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  const exists = await q('SELECT 1 FROM users WHERE email=$1', [email])
  if (exists.rowCount) return res.status(409).json({ error: 'Ese correo ya está registrado' })
  const hash = await bcrypt.hash(password, 10)
  const { rows } = await q('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email', [email, hash])
  await q('INSERT INTO settings(user_id) VALUES($1)', [rows[0].id])
  const token = jwt.sign({ id: rows[0].id, email }, SECRET, { expiresIn: '30d' })
  res.cookie(COOKIE, token, cookieOpts).json({ id: rows[0].id, email })
})

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const { rows } = await q('SELECT id,email,password_hash FROM users WHERE email=$1', [email])
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' })
  }
  const token = jwt.sign({ id: rows[0].id, email }, SECRET, { expiresIn: '30d' })
  res.cookie(COOKIE, token, cookieOpts).json({ id: rows[0].id, email })
})

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined }).json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email })
})

export default router
