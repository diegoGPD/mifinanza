import { Router } from 'express'
import crypto from 'node:crypto'
import { q } from './db.js'
import { requireAuth } from './auth.js'

const router = Router()
const CATS = ['comida', 'transporte', 'entretenimiento', 'servicios', 'salud', 'ropa', 'hogar', 'educacion', 'otros']
const KINDS = { compra: 'purchase', purchase: 'purchase', pago: 'payment', deposito: 'payment', 'depósito': 'payment', payment: 'payment', ingreso: 'income', income: 'income' }

const norm = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ---- Gestión del token (requiere sesión) ----
router.get('/token', requireAuth, async (req, res) => {
  const { rows } = await q('SELECT quick_token FROM settings WHERE user_id=$1', [req.user.id])
  res.json({ token: rows[0]?.quick_token || null })
})

router.post('/token', requireAuth, async (req, res) => {
  const token = crypto.randomBytes(18).toString('base64url')
  await q('UPDATE settings SET quick_token=$2 WHERE user_id=$1', [req.user.id, token])
  res.json({ token })
})

router.delete('/token', requireAuth, async (req, res) => {
  await q('UPDATE settings SET quick_token=NULL WHERE user_id=$1', [req.user.id])
  res.json({ ok: true })
})

// ---- Registro rápido por token (GET con query o POST con JSON/form) ----
async function handle(req, res) {
  const p = { ...req.query, ...(req.body || {}) }
  const wantsHtml = req.method === 'GET' && (req.headers.accept || '').includes('text/html')
  const reply = (status, body) => {
    if (!wantsHtml) return res.status(status).json(body)
    const ok = status < 300
    res.status(status).type('html').send(`<!DOCTYPE html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MiFinanza</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0d;color:#f0efec;font-family:system-ui,sans-serif}div{text-align:center;padding:24px}b{font-size:44px;display:block;color:${ok ? '#0ca30c' : '#d03b3b'}}p{color:#c3c2b7}</style></head>
<body><div><b>${ok ? '✓' : '✕'}</b><h2>${ok ? 'Registrado' : 'No se registró'}</h2><p>${ok ? `${body.description || ''} · $${Number(body.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}${body.card ? ' · ' + body.card : ''}` : body.error}</p></div></body></html>`)
  }

  const { rows: s } = await q('SELECT user_id FROM settings WHERE quick_token=$1', [req.params.token])
  if (!s.length) return reply(404, { error: 'Enlace inválido o revocado' })
  const uid = s[0].user_id

  const amount = Number(String(p.monto ?? p.amount ?? '').replace(/[$,\s]/g, ''))
  if (!(amount > 0)) return reply(400, { error: 'Falta un monto válido (monto=250)' })

  const kind = KINDS[norm(p.tipo ?? p.kind ?? 'compra')]
  if (!kind) return reply(400, { error: 'tipo debe ser compra, pago/deposito o ingreso' })

  // Tarjeta: por últimos 4, nombre o banco; si solo hay una, se usa esa
  const { rows: cards } = await q('SELECT id,name,bank,last4 FROM cards WHERE user_id=$1 ORDER BY id', [uid])
  const ref = norm(p.tarjeta ?? p.card ?? '')
  let card = null
  if (ref) {
    card = cards.find((c) => c.last4 && ref.endsWith(c.last4)) ||
      cards.find((c) => norm(c.name) === ref) ||
      cards.find((c) => norm(c.name).includes(ref) || ref.includes(norm(c.name))) ||
      cards.find((c) => norm(c.bank) === ref)
    if (!card) return reply(400, { error: `No encontré la tarjeta “${p.tarjeta ?? p.card}”` })
  } else if (kind !== 'income') {
    if (cards.length !== 1) return reply(400, { error: 'Indica la tarjeta (tarjeta=1234 o nombre)' })
    card = cards[0]
  }

  let category = norm(p.categoria ?? p.category ?? '')
  if (kind === 'income') category = 'ingreso'
  else if (!CATS.includes(category)) category = 'otros'

  const description = String(p.desc ?? p.descripcion ?? p.description ?? p.comercio ?? '').slice(0, 200)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha ?? '') ? p.fecha : null

  const { rows } = await q(
    `INSERT INTO transactions(user_id,card_id,amount,description,category,kind,date) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::date,(now() AT TIME ZONE 'America/Monterrey')::date)) RETURNING id,amount,description,category,kind,date`,
    [uid, card?.id ?? null, amount, description, category, kind, date]
  )
  reply(201, { ok: true, ...rows[0], card: card ? `${card.name}${card.last4 ? ' •••• ' + card.last4 : ''}` : null })
}

router.get('/:token', (req, res, next) => handle(req, res).catch(next))
router.post('/:token', (req, res, next) => handle(req, res).catch(next))

export default router
