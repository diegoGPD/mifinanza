import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useStore } from '../store.jsx'
import { Modal, Input, Select, Segmented, Progress, Icon, ChartTooltip, Empty, Stat } from '../ui.jsx'
import { mxn, mxn0, num, cardBalance, monthSpendByCategory, monthKey, catLabel, SERIES, CARD_COLORS, balanceSeries, fmtDate, msiRemaining, msiChargedCount, MONTHS, addMonths, parseISO, iso } from '../lib.js'

const axis = { fontSize: 11, fill: 'var(--muted)' }

/** Plan MSI ya en curso: la mensualidad nº `charged` es la de este mes; las ya cobradas se marcan como pagadas (están en el saldo actual). */
export function msiPlanFromExisting(card_id, r) {
  const charged = Math.max(0, Math.min(num(r.months), num(r.charged)))
  const first = charged === 0 ? addMonths(new Date(), 1) : addMonths(new Date(), -(charged - 1))
  return {
    card_id, description: r.description, category: r.category || 'otros', total: num(r.total), months: num(r.months),
    start_date: iso(new Date(first.getFullYear(), first.getMonth(), Math.min(new Date().getDate(), 28))),
    paid_installments: charged,
  }
}

export function CardForm({ card, onDone }) {
  const { create, update, remove } = useStore()
  const [f, setF] = useState({
    name: card?.name || '', bank: card?.bank || '', last4: card?.last4 || '', type: card?.type || 'credit',
    credit_limit: card?.credit_limit || '', initial_balance: card?.initial_balance || '', cut_day: card?.cut_day || '',
    pay_day: card?.pay_day || '', min_payment: card?.min_payment || '', no_interest_payment: card?.no_interest_payment || '', color: card?.color || CARD_COLORS[0],
  })
  const [msi, setMsi] = useState([]) // MSI en curso (solo al crear)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setMsiRow = (i, k, v) => setMsi(msi.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const body = {
      ...f,
      credit_limit: f.type === 'credit' ? num(f.credit_limit) : 0,
      initial_balance: num(f.initial_balance),
      cut_day: f.type === 'credit' ? num(f.cut_day) || null : null,
      pay_day: f.type === 'credit' ? num(f.pay_day) || null : null,
      min_payment: num(f.min_payment),
      no_interest_payment: num(f.no_interest_payment),
      last4: String(f.last4).replace(/\D/g, '').slice(-4),
    }
    try {
      if (card) await update('cards', card.id, body)
      else {
        const created = await create('cards', body)
        for (const r of msi) {
          if (num(r.total) <= 0 || num(r.months) <= 0) continue
          await create('msi_plans', msiPlanFromExisting(created.id, r))
        }
      }
      onDone()
    } catch (e) { setErr(e.message) }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Segmented value={f.type} onChange={(v) => setF({ ...f, type: v })} options={[{ value: 'credit', label: 'Crédito' }, { value: 'debit', label: 'Débito' }]} />
      <Input label="Nombre" value={f.name} onChange={set('name')} placeholder="Ej. Oro, Platinum, Nómina" required />
      <div className="row">
        <Input label="Banco" value={f.bank} onChange={set('bank')} placeholder="BBVA, Banorte…" />
        <Input label="Últimos 4 dígitos" value={f.last4} onChange={set('last4')} inputMode="numeric" maxLength={4} placeholder="1234" />
      </div>
      {f.type === 'credit' ? (
        <>
          <div className="row">
            <Input label="Límite de crédito" type="number" min="0" step="0.01" inputMode="decimal" value={f.credit_limit} onChange={set('credit_limit')} required />
            <Input label="Saldo actual (deuda)" type="number" min="0" step="0.01" inputMode="decimal" value={f.initial_balance} onChange={set('initial_balance')} />
          </div>
          <div className="row">
            <Input label="Día de corte" type="number" min="1" max="31" inputMode="numeric" value={f.cut_day} onChange={set('cut_day')} required />
            <Input label="Día límite de pago" type="number" min="1" max="31" inputMode="numeric" value={f.pay_day} onChange={set('pay_day')} required />
          </div>
          <div className="row">
            <Input label="Pago para no generar intereses" type="number" min="0" step="0.01" inputMode="decimal" value={f.no_interest_payment} onChange={set('no_interest_payment')} />
            <Input label="Pago mínimo" type="number" min="0" step="0.01" inputMode="decimal" value={f.min_payment} onChange={set('min_payment')} />
          </div>
          {!card && (
            <div className="field">
              <div className="row spread">
                <label>Compras a MSI en curso</label>
                <button type="button" className="btn ghost sm" onClick={() => setMsi([...msi, { description: '', total: '', months: 12, charged: 1 }])}><Icon name="plus" size={14} /> MSI</button>
              </div>
              {msi.map((r, i) => (
                <div key={i} className="card flat" style={{ gap: 8, padding: 10, marginBottom: 8 }}>
                  <div className="row">
                    <Input label="Descripción" value={r.description} onChange={(e) => setMsiRow(i, 'description', e.target.value)} placeholder="Laptop, viaje…" />
                    <Input label="Total (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={r.total} onChange={(e) => setMsiRow(i, 'total', e.target.value)} />
                  </div>
                  <div className="row">
                    <Input label="Meses" type="number" min="1" max="48" inputMode="numeric" value={r.months} onChange={(e) => setMsiRow(i, 'months', e.target.value)} />
                    <Input label="Ya cobradas" type="number" min="0" max={r.months} inputMode="numeric" value={r.charged} onChange={(e) => setMsiRow(i, 'charged', e.target.value)} />
                    <button type="button" className="icon-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setMsi(msi.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
                  </div>
                  {num(r.total) > 0 && num(r.months) > 0 && <div className="muted small">{mxn(num(r.total) / num(r.months))}/mes · faltan {Math.max(0, num(r.months) - num(r.charged))} mensualidades</div>}
                </div>
              ))}
              {msi.length > 0 && <div className="muted small">El “Saldo actual” debe incluir ya las mensualidades cobradas hasta hoy; las que faltan se irán sumando cada mes.</div>}
            </div>
          )}
        </>
      ) : (
        <Input label="Saldo actual" type="number" min="0" step="0.01" inputMode="decimal" value={f.initial_balance} onChange={set('initial_balance')} />
      )}
      <div className="field">
        <label>Color</label>
        <div className="row wrap">
          {CARD_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setF({ ...f, color: c })} aria-label={c}
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: f.color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />
          ))}
        </div>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="row">
        {card && <button type="button" className="btn danger" onClick={async () => { if (window.confirm('¿Eliminar tarjeta y todos sus movimientos?')) { await remove('cards', card.id); onDone(true) } }}><Icon name="trash" size={16} /></button>}
        <button className="btn" style={{ flex: 1 }}>{card ? 'Guardar' : 'Agregar tarjeta'}</button>
      </div>
    </form>
  )
}

function CardVisual({ card, balance, onClick }) {
  const limit = num(card.credit_limit)
  const avail = limit - balance
  return (
    <div className="ccard" style={{ '--cc': card.color }} onClick={onClick}>
      <div className="row spread">
        <span className="bank">{card.bank || (card.type === 'credit' ? 'Crédito' : 'Débito')}</span>
        <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>{card.type === 'credit' ? 'Crédito' : 'Débito'}</span>
      </div>
      <div><div className="name">{card.name}</div><div className="last4">•••• {card.last4 || '····'}</div></div>
      {card.type === 'credit' ? (
        <>
          <div className="bottom">
            <div>Saldo<b className="num">{mxn(balance)}</b></div>
            <div style={{ textAlign: 'right' }}>Disponible<b className="num">{mxn(avail)}</b></div>
          </div>
          <Progress value={balance} max={limit} />
        </>
      ) : (
        <div className="bottom"><div>Saldo disponible<b className="num">{mxn(balance)}</b></div></div>
      )}
    </div>
  )
}

export default function Cards({ selectedId, onSelect }) {
  const { data } = useStore()
  const [adding, setAdding] = useState(false)
  const { cards, transactions, msi_plans } = data
  const selected = cards.find((c) => c.id === selectedId)
  if (selected) return <CardDetail card={selected} onBack={() => onSelect(null)} />

  return (
    <div className="page">
      <div className="card-head">
        <h1>Tarjetas</h1>
        <button className="btn sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Nueva</button>
      </div>
      {cards.length === 0 && <Empty>Aún no tienes tarjetas.</Empty>}
      <div className="grid c2">
        {cards.map((c) => (
          <CardVisual key={c.id} card={c} balance={cardBalance(c, transactions, msi_plans)} onClick={() => onSelect(c.id)} />
        ))}
      </div>
      {adding && <Modal title="Nueva tarjeta" onClose={() => setAdding(false)}><CardForm onDone={() => setAdding(false)} /></Modal>}
    </div>
  )
}

function CardDetail({ card, onBack }) {
  const { data, remove, update } = useStore()
  const { transactions, msi_plans } = data
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('mov')
  const balance = cardBalance(card, transactions, msi_plans)
  const limit = num(card.credit_limit)
  const txs = transactions.filter((t) => t.card_id === card.id)
  const plans = msi_plans.filter((p) => p.card_id === card.id)

  const pie = useMemo(() => {
    const byCat = monthSpendByCategory(txs, plans, monthKey(new Date()))
    return Object.entries(byCat).map(([k, v]) => ({ name: catLabel(k), value: Math.round(v * 100) / 100 })).sort((a, b) => b.value - a.value)
  }, [txs, plans])
  const pieTotal = pie.reduce((a, b) => a + b.value, 0)

  const series = useMemo(() => balanceSeries(card, transactions, msi_plans, 60), [card, transactions, msi_plans])
  const monthlyMsi = plans.reduce((a, p) => a + (msiRemaining(p) > 0 ? num(p.total) / p.months : 0), 0)

  return (
    <div className="page">
      <div className="row spread">
        <button className="icon-btn" onClick={onBack}><Icon name="back" /></button>
        <h1 style={{ flex: 1 }}>{card.name}</h1>
        <button className="icon-btn" onClick={() => setEditing(true)}><Icon name="edit" /></button>
      </div>
      <CardVisual card={card} balance={balance} onClick={() => {}} />
      {card.type === 'credit' && (
        <div className="grid c3">
          <Stat label="Corte" value={`Día ${card.cut_day || '—'}`} sub="de cada mes" />
          <Stat label="Pago" value={`Día ${card.pay_day || '—'}`} sub={[num(card.no_interest_payment) ? `Sin intereses ${mxn0(card.no_interest_payment)}` : '', num(card.min_payment) ? `Mínimo ${mxn0(card.min_payment)}` : ''].filter(Boolean).join(' · ') || 'de cada mes'} />
          <Stat label="MSI mensuales" value={mxn(monthlyMsi)} sub={`${plans.filter((p) => msiRemaining(p) > 0).length} planes activos`} />
        </div>
      )}

      <div className="grid c2">
        <div className="card">
          <div className="card-head"><h2>Gasto por categoría</h2><span className="muted small">Este mes</span></div>
          {pie.length === 0 ? <Empty>Sin gastos este mes.</Empty> : (
            <div className="row" style={{ alignItems: 'center' }}>
              <div style={{ width: 150, height: 150, flex: 'none' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie isAnimationActive={false} data={pie} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                      {pie.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="list" style={{ flex: 1, minWidth: 0 }}>
                {pie.slice(0, 6).map((p, i) => (
                  <div className="item" key={p.name} style={{ padding: '5px 0' }}>
                    <span className="dot" style={{ background: SERIES[i % SERIES.length] }} />
                    <div className="main"><div className="title small">{p.name}</div></div>
                    <span className="small num">{Math.round((p.value / pieTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Saldo en el tiempo</h2><span className="muted small">60 días</span></div>
          <div className="chart" style={{ height: 170 }}>
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={axis} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} interval={14} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => '$' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
                <Tooltip content={<ChartTooltip />} />
                <Line isAnimationActive={false} type="monotone" dataKey="saldo" name="Saldo" stroke={card.color} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'mov', label: `Movimientos (${txs.length})` }, { value: 'msi', label: `MSI (${plans.length})` }]} />
        {tab === 'mov' && (txs.length === 0 ? <Empty>Sin movimientos.</Empty> : (
          <div className="list">
            {txs.map((t) => (
              <div className="item" key={t.id}>
                <div className="main">
                  <div className="title">{t.description || catLabel(t.category)}</div>
                  <div className="sub">{fmtDate(t.date)} · {t.kind === 'payment' ? (card.type === 'debit' ? 'Depósito' : 'Pago a tarjeta') : t.kind === 'income' ? 'Ingreso' : catLabel(t.category)}</div>
                </div>
                <span className={'amt num ' + (t.kind !== 'purchase' ? 'pos' : '')}>{t.kind === 'purchase' ? '−' : '+'}{mxn(t.amount)}</span>
                <button className="icon-btn" onClick={() => window.confirm('¿Eliminar movimiento?') && remove('transactions', t.id)}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        ))}
        {tab === 'msi' && (plans.length === 0 ? <Empty>Sin compras a MSI en esta tarjeta.</Empty> : (
          <div className="list">
            {plans.map((p) => {
              const charged = msiChargedCount(p)
              const monthly = num(p.total) / p.months
              const end = addMonths(parseISO(p.start_date), p.months - 1)
              return (
                <div className="item" key={p.id} style={{ alignItems: 'flex-start' }}>
                  <div className="main" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="title">{p.description || catLabel(p.category)}</div>
                    <div className="sub">{mxn(monthly)}/mes · {charged}/{p.months} cobradas · termina {MONTHS[end.getMonth()]} {end.getFullYear()}</div>
                    <Progress value={charged} max={p.months} color={card.color} />
                    <div className="row">
                      <span className="small muted">Pagadas: {p.paid_installments || 0}</span>
                      <button className="btn ghost sm" onClick={() => update('msi_plans', p.id, { paid_installments: Math.min(p.months, (p.paid_installments || 0) + 1) })}>+1 pagada</button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="amt num">{mxn(p.total)}</div>
                    <div className="sub">{p.months} MSI</div>
                    <button className="icon-btn" onClick={() => window.confirm('¿Eliminar plan MSI?') && remove('msi_plans', p.id)}><Icon name="trash" size={16} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {editing && <Modal title="Editar tarjeta" onClose={() => setEditing(false)}><CardForm card={card} onDone={(deleted) => { setEditing(false); if (deleted) onBack() }} /></Modal>}
    </div>
  )
}
