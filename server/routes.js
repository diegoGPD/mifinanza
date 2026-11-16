import { Router } from 'express'
import { q, pool } from './db.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth)

// ---------- Definición de recursos (CRUD genérico, siempre filtrado por user_id) ----------
const RESOURCES = {
  cards: ['name', 'bank', 'last4', 'type', 'credit_limit', 'initial_balance', 'cut_day', 'pay_day', 'min_payment', 'no_interest_payment', 'color'],
  transactions: ['card_id', 'amount', 'description', 'category', 'kind', 'date'],
  msi_plans: ['card_id', 'description', 'category', 'total', 'months', 'start_date', 'paid_installments'],
  recurring: ['card_id', 'description', 'amount', 'category', 'day_of_month', 'active'],
  goals: ['name', 'target', 'current', 'deadline'],
}

const clean = (v) => (v === '' || v === undefined ? null : v)

for (const [table, fields] of Object.entries(RESOURCES)) {
  router.get(`/${table}`, async (req, res) => {
    const { rows } = await q(`SELECT * FROM ${table} WHERE user_id=$1 ORDER BY id`, [req.user.id])
    res.json(rows)
  })

  router.post(`/${table}`, async (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined)
    const vals = cols.map((f) => clean(req.body[f]))
    const params = cols.map((_, i) => `$${i + 2}`)
    const { rows } = await q(
      `INSERT INTO ${table}(user_id${cols.length ? ',' + cols.join(',') : ''}) VALUES($1${params.length ? ',' + params.join(',') : ''}) RETURNING *`,
      [req.user.id, ...vals]
    )
    res.status(201).json(rows[0])
  })

  router.put(`/${table}/:id`, async (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined)
    if (!cols.length) return res.status(400).json({ error: 'Nada que actualizar' })
    const sets = cols.map((f, i) => `${f}=$${i + 3}`)
    const { rows } = await q(
      `UPDATE ${table} SET ${sets.join(',')} WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user.id, ...cols.map((f) => clean(req.body[f]))]
    )
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
    res.json(rows[0])
  })

  router.delete(`/${table}/:id`, async (req, res) => {
    await q(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id])
    res.json({ ok: true })
  })
}

// ---------- Settings ----------
router.get('/settings', async (req, res) => {
  const { rows } = await q('SELECT * FROM settings WHERE user_id=$1', [req.user.id])
  res.json(rows[0])
})

router.put('/settings', async (req, res) => {
  const fields = ['monthly_income', 'hourly_rate', 'hours_per_week', 'monthly_budget', 'category_budgets', 'theme', 'setup_done']
  const cols = fields.filter((f) => req.body[f] !== undefined)
  if (!cols.length) return res.status(400).json({ error: 'Nada que actualizar' })
  const sets = cols.map((f, i) => `${f}=$${i + 2}`)
  const { rows } = await q(`UPDATE settings SET ${sets.join(',')} WHERE user_id=$1 RETURNING *`, [
    req.user.id,
    ...cols.map((f) => (f === 'category_budgets' ? JSON.stringify(req.body[f]) : clean(req.body[f]))),
  ])
  res.json(rows[0])
})

// ---------- Auto-registro de pagos recurrentes ----------
async function postRecurring(userId) {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth() + 1, d = today.getDate()
  const { rows } = await q('SELECT * FROM recurring WHERE user_id=$1 AND active=true', [userId])
  for (const r of rows) {
    if (r.day_of_month > d) continue
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    if (r.last_posted && new Date(r.last_posted) >= new Date(monthStart)) continue
    const date = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(r.day_of_month, 28)).padStart(2, '0')}`
    await q(
      `INSERT INTO transactions(user_id,card_id,amount,description,category,kind,date) VALUES($1,$2,$3,$4,$5,'purchase',$6)`,
      [userId, r.card_id, r.amount, `${r.description} (recurrente)`, r.category, date]
    )
    await q('UPDATE recurring SET last_posted=$1 WHERE id=$2', [date, r.id])
  }
}

// ---------- Estado completo (una sola llamada al cargar) ----------
router.get('/state', async (req, res) => {
  const uid = req.user.id
  await postRecurring(uid)
  const [settings, cards, transactions, msi_plans, recurring, goals] = await Promise.all([
    q('SELECT * FROM settings WHERE user_id=$1', [uid]),
    q('SELECT * FROM cards WHERE user_id=$1 ORDER BY id', [uid]),
    q('SELECT * FROM transactions WHERE user_id=$1 ORDER BY date DESC, id DESC', [uid]),
    q('SELECT * FROM msi_plans WHERE user_id=$1 ORDER BY id', [uid]),
    q('SELECT * FROM recurring WHERE user_id=$1 ORDER BY id', [uid]),
    q('SELECT * FROM goals WHERE user_id=$1 ORDER BY id', [uid]),
  ])
  res.json({
    settings: settings.rows[0],
    cards: cards.rows,
    transactions: transactions.rows,
    msi_plans: msi_plans.rows,
    recurring: recurring.rows,
    goals: goals.rows,
  })
})

// ---------- Export / Import (respaldo JSON) ----------
router.get('/export', async (req, res) => {
  const uid = req.user.id
  const out = { version: 1, exported_at: new Date().toISOString() }
  for (const t of ['settings', 'cards', 'transactions', 'msi_plans', 'recurring', 'goals']) {
    const { rows } = await q(`SELECT * FROM ${t} WHERE user_id=$1 ORDER BY ${t === 'settings' ? 'user_id' : 'id'}`, [uid])
    out[t] = rows
  }
  res.setHeader('Content-Disposition', 'attachment; filename="mifinanza-backup.json"')
  res.json(out)
})

router.post('/import', async (req, res) => {
  const uid = req.user.id
  const data = req.body
  if (!data || !Array.isArray(data.cards)) return res.status(400).json({ error: 'Archivo inválido' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const t of ['transactions', 'msi_plans', 'recurring', 'goals', 'cards']) {
      await client.query(`DELETE FROM ${t} WHERE user_id=$1`, [uid])
    }
    const idMap = {}
    for (const c of data.cards) {
      const { rows } = await client.query(
        `INSERT INTO cards(user_id,name,bank,last4,type,credit_limit,initial_balance,cut_day,pay_day,min_payment,no_interest_payment,color) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [uid, c.name, c.bank, c.last4, c.type, c.credit_limit, c.initial_balance, c.cut_day, c.pay_day, c.min_payment, c.no_interest_payment || 0, c.color]
      )
      idMap[c.id] = rows[0].id
    }
    const mapCard = (id) => (id == null ? null : idMap[id] ?? null)
    for (const t of data.transactions || []) {
      await client.query(
        `INSERT INTO transactions(user_id,card_id,amount,description,category,kind,date) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [uid, mapCard(t.card_id), t.amount, t.description, t.category, t.kind, t.date]
      )
    }
    for (const p of data.msi_plans || []) {
      await client.query(
        `INSERT INTO msi_plans(user_id,card_id,description,category,total,months,start_date,paid_installments) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uid, mapCard(p.card_id), p.description, p.category, p.total, p.months, p.start_date, p.paid_installments]
      )
    }
    for (const r of data.recurring || []) {
      await client.query(
        `INSERT INTO recurring(user_id,card_id,description,amount,category,day_of_month,active,last_posted) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uid, mapCard(r.card_id), r.description, r.amount, r.category, r.day_of_month, r.active, r.last_posted]
      )
    }
    for (const g of data.goals || []) {
      await client.query(`INSERT INTO goals(user_id,name,target,current,deadline) VALUES($1,$2,$3,$4,$5)`, [
        uid, g.name, g.target, g.current, g.deadline,
      ])
    }
    const s = Array.isArray(data.settings) ? data.settings[0] : data.settings
    if (s) {
      await client.query(
        `UPDATE settings SET monthly_income=$2,hourly_rate=$3,hours_per_week=$4,monthly_budget=$5,category_budgets=$6,theme=$7,setup_done=$8 WHERE user_id=$1`,
        [uid, s.monthly_income, s.hourly_rate, s.hours_per_week, s.monthly_budget, JSON.stringify(s.category_budgets || {}), s.theme || 'dark', s.setup_done ?? true]
      )
    }
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: 'No se pudo importar' })
  } finally {
    client.release()
  }
})

export default router
