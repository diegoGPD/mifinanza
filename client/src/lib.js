// ---------- Formato ----------
export const mxn = (n) =>
  '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const mxn0 = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX')
export const num = (v) => Number(v) || 0

export const CATEGORIES = [
  { id: 'comida', label: 'Comida' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'entretenimiento', label: 'Entretenimiento' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'salud', label: 'Salud' },
  { id: 'ropa', label: 'Ropa' },
  { id: 'hogar', label: 'Hogar' },
  { id: 'educacion', label: 'Educación' },
  { id: 'otros', label: 'Otros' },
]
export const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id || 'Otros'

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)']
export const CARD_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#52514e']

// ---------- Fechas ----------
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseISO = (s) => {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()
export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const fmtDate = (s) => {
  const d = parseISO(s)
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : ''
}
export const fmtDateLong = (s) => {
  const d = parseISO(s)
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ''
}
export const addMonths = (d, n) => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  r.setDate(Math.min(d.getDate(), daysInMonth(r.getFullYear(), r.getMonth())))
  return r
}
export const clampDay = (y, m, day) => Math.min(day || 1, daysInMonth(y, m))

// ---------- Cálculos ----------
/** Signo de un movimiento sobre el saldo de la tarjeta.
 *  Crédito: saldo = deuda (compra suma, pago resta).
 *  Débito: saldo = dinero a favor (compra resta, depósito/ingreso suma). */
export function txDelta(card, t) {
  const amt = num(t.amount)
  if (card.type === 'debit') return t.kind === 'purchase' ? -amt : t.kind === 'payment' || t.kind === 'income' ? amt : 0
  return t.kind === 'purchase' ? amt : t.kind === 'payment' ? -amt : 0
}

/** Saldo actual. Crédito: deuda pendiente (inicial + compras + MSI cobradas − pagos). Débito: fondos disponibles. */
export function cardBalance(card, transactions, msiPlans) {
  let bal = num(card.initial_balance)
  for (const t of transactions) {
    if (t.card_id !== card.id) continue
    bal += txDelta(card, t)
  }
  if (card.type === 'debit') return bal
  for (const p of msiPlans) {
    if (p.card_id !== card.id) continue
    // Las mensualidades de MSI ya cobradas forman parte del saldo pendiente de pago
    const monthly = num(p.total) / p.months
    const charged = msiChargedCount(p)
    const paid = Math.min(num(p.paid_installments), charged)
    bal += (charged - paid) * monthly
  }
  return bal
}

/** Número de mensualidades que ya se cargaron (según fecha de inicio) */
export function msiChargedCount(p, ref = new Date()) {
  const start = parseISO(p.start_date)
  if (!start) return 0
  const months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth()) + 1
  return Math.max(0, Math.min(p.months, months))
}

/** Calendario de cargos MSI: [{month:'YYYY-MM', card_id, plan, amount}] desde hoy */
export function msiSchedule(msiPlans, from = new Date()) {
  const out = []
  for (const p of msiPlans) {
    const start = parseISO(p.start_date)
    if (!start) continue
    const monthly = num(p.total) / p.months
    for (let i = 0; i < p.months; i++) {
      const d = addMonths(start, i)
      if (d < new Date(from.getFullYear(), from.getMonth(), 1)) continue
      out.push({ month: monthKey(d), date: d, card_id: p.card_id, plan: p, amount: monthly, n: i + 1 })
    }
  }
  return out.sort((a, b) => a.date - b.date)
}

export function msiRemaining(p) {
  return Math.max(0, p.months - msiChargedCount(p))
}

/** Gasto del mes por categoría (compras + MSI cobradas este mes + recurrentes ya registrados) */
export function monthSpendByCategory(transactions, msiPlans, ym) {
  const acc = {}
  for (const t of transactions) {
    if (t.kind !== 'purchase' || String(t.date).slice(0, 7) !== ym) continue
    acc[t.category] = (acc[t.category] || 0) + num(t.amount)
  }
  for (const s of msiSchedule(msiPlans, parseISO(ym + '-01'))) {
    if (s.month !== ym) continue
    acc[s.plan.category] = (acc[s.plan.category] || 0) + s.amount
  }
  return acc
}

export function monthTotals(transactions, msiPlans, ym) {
  const byCat = monthSpendByCategory(transactions, msiPlans, ym)
  const expenses = Object.values(byCat).reduce((a, b) => a + b, 0)
  const income = transactions
    .filter((t) => t.kind === 'income' && String(t.date).slice(0, 7) === ym)
    .reduce((a, t) => a + num(t.amount), 0)
  return { expenses, income, byCat }
}

/** Serie de saldo por día para una tarjeta (últimos N días) */
export function balanceSeries(card, transactions, msiPlans, days = 60) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - days)
  // saldo al inicio: calcular saldo total menos movimientos posteriores al inicio
  const current = cardBalance(card, transactions, msiPlans)
  const txs = transactions.filter((t) => t.card_id === card.id && parseISO(t.date) > start)
  let bal = current
  for (const t of txs) bal -= txDelta(card, t)
  const byDay = {}
  for (const t of txs) {
    const k = String(t.date).slice(0, 10)
    byDay[k] = (byDay[k] || 0) + txDelta(card, t)
  }
  const out = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = iso(d)
    bal += byDay[k] || 0
    out.push({ date: k, label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, saldo: Math.round(bal * 100) / 100 })
  }
  return out
}

/** Presupuesto diario */
export function dailyBudget(settings, transactions, msiPlans) {
  const now = new Date()
  const ym = monthKey(now)
  const dim = daysInMonth(now.getFullYear(), now.getMonth())
  const today = now.getDate()
  const budget = num(settings.monthly_budget)
  const spent = transactions
    .filter((t) => t.kind === 'purchase' && String(t.date).slice(0, 7) === ym)
    .reduce((a, t) => a + num(t.amount), 0)
  const spentToday = transactions
    .filter((t) => t.kind === 'purchase' && String(t.date).slice(0, 10) === todayISO())
    .reduce((a, t) => a + num(t.amount), 0)
  const remainingDays = dim - today + 1
  const remaining = budget - spent
  const base = budget / dim
  const expectedSoFar = base * (today - 1)
  const spentBeforeToday = spent - spentToday
  const surplus = expectedSoFar - spentBeforeToday
  const todayAllowance = (budget - spentBeforeToday) / remainingDays
  return { budget, spent, spentToday, remaining, remainingDays, base, todayAllowance, surplus, leftToday: todayAllowance - spentToday }
}

export function hourlyRate(settings) {
  const hr = num(settings.hourly_rate)
  if (hr > 0) return hr
  const inc = num(settings.monthly_income)
  const hpw = num(settings.hours_per_week) || 40
  return inc > 0 ? inc / ((hpw * 52) / 12) : 0
}

export const fmtHours = (h) => {
  if (!isFinite(h) || h <= 0) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 8) return `${h.toFixed(1)} h`
  const days = h / 8
  if (days < 22) return `${h.toFixed(0)} h (${days.toFixed(1)} días)`
  return `${h.toFixed(0)} h (${(days / 22).toFixed(1)} meses)`
}
