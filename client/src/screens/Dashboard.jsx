import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useStore } from '../store.jsx'
import { Stat, ChartTooltip, Empty } from '../ui.jsx'
import { mxn, mxn0, num, cardBalance, monthTotals, monthKey, MONTHS, msiSchedule, dailyBudget, fmtDate, catLabel, addMonths, clampDay, iso } from '../lib.js'

const axis = { fontSize: 11, fill: 'var(--muted)' }

export default function Dashboard({ onOpenCard }) {
  const { data } = useStore()
  const { cards, transactions, msi_plans, settings } = data

  const totals = useMemo(() => {
    let debt = 0, limit = 0, funds = 0
    for (const c of cards) {
      const b = cardBalance(c, transactions, msi_plans)
      if (c.type === 'credit') { debt += Math.max(0, b); limit += num(c.credit_limit) }
      else funds += b
    }
    return { debt, available: Math.max(0, limit - debt), limit, funds, net: funds - debt }
  }, [cards, transactions, msi_plans])

  const monthly = useMemo(() => {
    const out = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = monthKey(d)
      const t = monthTotals(transactions, msi_plans, ym)
      const income = i === 0 || t.income > 0 ? Math.max(t.income, i === 0 ? num(settings.monthly_income) : 0) : num(settings.monthly_income)
      out.push({ mes: MONTHS[d.getMonth()], Ingresos: Math.round(income), Gastos: Math.round(t.expenses) })
    }
    return out
  }, [transactions, msi_plans, settings])

  const msiByMonth = useMemo(() => {
    const sched = msiSchedule(msi_plans)
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const ym = monthKey(d)
      const row = { ym, mes: MONTHS[d.getMonth()] + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : '') }
      for (const c of cards) row[c.name] = 0
      for (const s of sched.filter((s) => s.month === ym)) {
        const c = cards.find((c) => c.id === s.card_id)
        if (c) row[c.name] = Math.round((row[c.name] + s.amount) * 100) / 100
      }
      months.push(row)
    }
    const last = months.findLastIndex((r) => cards.some((c) => r[c.name] > 0))
    return months.slice(0, Math.max(3, last + 1))
  }, [msi_plans, cards])

  const upcomingMsi = useMemo(() => msiSchedule(msi_plans).slice(0, 6), [msi_plans])
  const db = dailyBudget(settings, transactions, msi_plans)
  const thisMonth = monthTotals(transactions, msi_plans, monthKey(new Date()))

  const nextDates = useMemo(() => {
    const now = new Date()
    const out = []
    for (const c of cards.filter((c) => c.type === 'credit')) {
      for (const [kind, day] of [['corte', c.cut_day], ['pago', c.pay_day]]) {
        if (!day) continue
        let d = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth(), day))
        if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1), d.setDate(clampDay(d.getFullYear(), d.getMonth(), day))
        out.push({ card: c, kind, date: d, days: Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000) })
      }
    }
    return out.sort((a, b) => a.date - b.date).slice(0, 5)
  }, [cards])

  const monthMsiTotal = msiByMonth[0] ? cards.reduce((a, c) => a + (msiByMonth[0][c.name] || 0), 0) : 0

  return (
    <div className="page">
      <div className="grid c2">
        <Stat label="Saldo en débito" value={mxn(totals.funds)} sub={`Neto (débito − deuda): ${mxn(totals.net)}`} tone={totals.funds > 0 ? 'pos' : ''} />
        <Stat label="Deuda total (crédito)" value={mxn(totals.debt)} sub={`Límite total ${mxn0(totals.limit)}`} tone={totals.debt > 0 ? '' : 'pos'} />
        <Stat label="Crédito disponible" value={mxn(totals.available)} sub={totals.limit ? `${Math.round((totals.available / totals.limit) * 100)}% libre` : 'Sin tarjetas de crédito'} />
        <Stat label="Gasto de hoy / permitido" value={`${mxn0(db.spentToday)} / ${mxn0(db.todayAllowance)}`}
          sub={db.budget ? (db.leftToday >= 0 ? `Te quedan ${mxn(db.leftToday)} hoy` : `Excediste por ${mxn(-db.leftToday)}`) : 'Configura tu presupuesto en Metas'}
          tone={db.budget ? (db.leftToday >= 0 ? 'pos' : 'neg') : ''} />
        <Stat label="MSI comprometidos este mes" value={mxn(monthMsiTotal)} sub={`${msi_plans.length} plan${msi_plans.length === 1 ? '' : 'es'} activos`} />
      </div>

      <div className="card">
        <div className="card-head"><h2>Ingresos vs gastos</h2><span className="muted small">Últimos 6 meses</span></div>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={monthly} barGap={2} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="mes" tick={axis} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="Ingresos" fill="var(--s3)" radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Gastos" fill="var(--s2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="row spread small">
          <span className="muted">Este mes</span>
          <span className="num">{mxn(thisMonth.income || num(settings.monthly_income))} − {mxn(thisMonth.expenses)} = <b className={thisMonth.income || num(settings.monthly_income) >= thisMonth.expenses ? 'pos' : 'neg'}>{mxn((thisMonth.income || num(settings.monthly_income)) - thisMonth.expenses)}</b></span>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>MSI por mes</h2><span className="muted small">Pagos comprometidos por tarjeta</span></div>
        {msi_plans.length === 0 ? <Empty>Sin compras a meses sin intereses. Agrégalas con el botón +.</Empty> : (
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={msiByMonth} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="mes" tick={axis} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                {cards.map((c, i) => (
                  <Bar isAnimationActive={false} key={c.id} dataKey={c.name} stackId="a" fill={c.color} stroke="var(--surface)" strokeWidth={1}
                    radius={i === cards.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid c2">
        <div className="card">
          <h2>Próximas fechas</h2>
          {nextDates.length === 0 ? <Empty>Agrega fechas de corte y pago a tus tarjetas.</Empty> : (
            <div className="list">
              {nextDates.map((n, i) => (
                <div className="item" key={i} onClick={() => onOpenCard(n.card.id)} style={{ cursor: 'pointer' }}>
                  <span className="dot" style={{ background: n.card.color }} />
                  <div className="main">
                    <div className="title">{n.kind === 'corte' ? 'Corte' : 'Pago'} · {n.card.name}</div>
                    <div className="sub">{fmtDate(iso(n.date))}</div>
                  </div>
                  <span className={'chip ' + (n.days <= 3 ? 'crit' : n.days <= 7 ? 'warn' : '')}>{n.days === 0 ? 'Hoy' : n.days === 1 ? 'Mañana' : `${n.days} días`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Próximos cargos MSI</h2>
          {upcomingMsi.length === 0 ? <Empty>Sin cargos pendientes.</Empty> : (
            <div className="list">
              {upcomingMsi.map((s, i) => {
                const c = cards.find((c) => c.id === s.card_id)
                return (
                  <div className="item" key={i}>
                    <span className="dot" style={{ background: c?.color }} />
                    <div className="main">
                      <div className="title">{s.plan.description || catLabel(s.plan.category)}</div>
                      <div className="sub">{c?.name} · {s.n}/{s.plan.months} · {MONTHS[s.date.getMonth()]} {s.date.getFullYear()}</div>
                    </div>
                    <span className="amt num">{mxn(s.amount)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Movimientos recientes</h2>
        {transactions.length === 0 ? <Empty>Registra tu primera compra con el botón +.</Empty> : (
          <div className="list">
            {transactions.slice(0, 8).map((t) => {
              const c = cards.find((c) => c.id === t.card_id)
              return (
                <div className="item" key={t.id}>
                  <span className="dot" style={{ background: t.kind === 'income' ? 'var(--good)' : c?.color || 'var(--muted)' }} />
                  <div className="main">
                    <div className="title">{t.description || catLabel(t.category)}</div>
                    <div className="sub">{fmtDate(t.date)} · {t.kind === 'income' ? 'Ingreso' : t.kind === 'payment' ? 'Pago a tarjeta' : catLabel(t.category)}{c ? ' · ' + c.name : ''}</div>
                  </div>
                  <span className={'amt num ' + (t.kind === 'income' ? 'pos' : t.kind === 'payment' ? 'pos' : '')}>{t.kind === 'purchase' ? '−' : '+'}{mxn(t.amount)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
