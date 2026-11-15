import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { Icon, Empty } from '../ui.jsx'
import { mxn, mxn0, num, MONTHS_LONG, daysInMonth, clampDay, msiSchedule, monthKey, iso, catLabel, todayISO } from '../lib.js'

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const KIND_COLOR = { corte: 'var(--s4)', pago: 'var(--critical)', msi: 'var(--s1)', recurrente: 'var(--s7)', compra: 'var(--muted)' }

export default function Calendar() {
  const { data } = useStore()
  const { cards, msi_plans, recurring, transactions } = data
  const [cur, setCur] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState(todayISO())

  const y = cur.getFullYear(), m = cur.getMonth()
  const dim = daysInMonth(y, m)
  const firstDow = (cur.getDay() + 6) % 7 // lunes = 0
  const ym = monthKey(cur)

  const events = useMemo(() => {
    const ev = {}
    const add = (day, e) => { const k = `${ym}-${String(day).padStart(2, '0')}`; (ev[k] ||= []).push(e) }
    for (const c of cards.filter((c) => c.type === 'credit')) {
      if (c.cut_day) add(clampDay(y, m, c.cut_day), { kind: 'corte', title: `Corte · ${c.name}`, color: c.color, amount: 0 })
      if (c.pay_day) add(clampDay(y, m, c.pay_day), { kind: 'pago', title: `Fecha límite de pago · ${c.name}`, color: c.color, amount: num(c.min_payment) })
    }
    for (const s of msiSchedule(msi_plans, cur)) {
      if (s.month !== ym) continue
      const c = cards.find((c) => c.id === s.card_id)
      add(s.date.getDate(), { kind: 'msi', title: `MSI ${s.n}/${s.plan.months} · ${s.plan.description || catLabel(s.plan.category)}`, color: c?.color, amount: s.amount, sub: c?.name })
    }
    for (const r of recurring.filter((r) => r.active)) {
      const c = cards.find((c) => c.id === r.card_id)
      add(clampDay(y, m, r.day_of_month), { kind: 'recurrente', title: r.description, color: c?.color, amount: num(r.amount), sub: c?.name || 'Efectivo' })
    }
    for (const t of transactions.filter((t) => t.kind === 'purchase' && String(t.date).slice(0, 7) === ym && !String(t.description).includes('(recurrente)'))) {
      const c = cards.find((c) => c.id === t.card_id)
      add(Number(String(t.date).slice(8, 10)), { kind: 'compra', title: t.description || catLabel(t.category), color: c?.color, amount: num(t.amount), sub: c?.name })
    }
    return ev
  }, [cards, msi_plans, recurring, transactions, ym, y, m, cur])

  const monthExpected = Object.values(events).flat().filter((e) => e.kind !== 'compra').reduce((a, e) => a + e.amount, 0)
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  const selEvents = events[sel] || []

  return (
    <div className="page">
      <div className="row spread">
        <button className="icon-btn" onClick={() => setCur(new Date(y, m - 1, 1))}><Icon name="chevL" /></button>
        <h1>{MONTHS_LONG[m]} {y}</h1>
        <button className="icon-btn" onClick={() => setCur(new Date(y, m + 1, 1))}><Icon name="chevR" /></button>
      </div>
      <div className="card">
        <div className="legend">
          <span><span className="dot" style={{ background: KIND_COLOR.corte }} />Corte</span>
          <span><span className="dot" style={{ background: KIND_COLOR.pago }} />Pago</span>
          <span><span className="dot" style={{ background: KIND_COLOR.msi }} />MSI</span>
          <span><span className="dot" style={{ background: KIND_COLOR.recurrente }} />Recurrente</span>
          <span><span className="dot" style={{ background: KIND_COLOR.compra }} />Compra</span>
        </div>
        <div className="cal">
          {DOW.map((d, i) => <div className="dow" key={i}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div className="day empty" key={'e' + i} />
            const key = `${ym}-${String(d).padStart(2, '0')}`
            const ev = events[key] || []
            const total = ev.reduce((a, e) => a + e.amount, 0)
            return (
              <div key={key} className={'day' + (key === todayISO() ? ' today' : '') + (key === sel ? ' selected' : '')} onClick={() => setSel(key)}>
                <span className="n">{d}</span>
                <div className="marks">{ev.slice(0, 6).map((e, j) => <span className="mark" key={j} style={{ background: KIND_COLOR[e.kind] }} />)}</div>
                {total > 0 && <span className="amt num">{mxn0(total)}</span>}
              </div>
            )
          })}
        </div>
        <div className="row spread small"><span className="muted">Cargos esperados del mes</span><b className="num">{mxn(monthExpected)}</b></div>
      </div>

      <div className="card">
        <h2>{sel ? `${Number(sel.slice(8, 10))} de ${MONTHS_LONG[Number(sel.slice(5, 7)) - 1]}` : 'Selecciona un día'}</h2>
        {selEvents.length === 0 ? <Empty>Nada programado este día.</Empty> : (
          <div className="list">
            {selEvents.map((e, i) => (
              <div className="item" key={i}>
                <span className="dot" style={{ background: KIND_COLOR[e.kind] }} />
                <div className="main"><div className="title">{e.title}</div><div className="sub">{e.sub || ''}{e.kind === 'pago' && e.amount ? ' · pago mínimo' : ''}</div></div>
                {e.amount > 0 && <span className="amt num">{mxn(e.amount)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
