import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Modal, Input, Progress, Ring, Icon, Empty, Stat } from '../ui.jsx'
import { mxn, mxn0, num, CATEGORIES, catLabel, dailyBudget, monthSpendByCategory, monthKey, fmtDateLong, parseISO, SERIES } from '../lib.js'

function GoalForm({ goal, onClose }) {
  const { create, update, remove } = useStore()
  const [f, setF] = useState({ name: goal?.name || '', target: goal?.target || '', current: goal?.current || '', deadline: goal?.deadline ? String(goal.deadline).slice(0, 10) : '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    const body = { name: f.name, target: num(f.target), current: num(f.current), deadline: f.deadline || null }
    if (goal) await update('goals', goal.id, body); else await create('goals', body)
    onClose()
  }
  return (
    <Modal title={goal ? 'Editar meta' : 'Nueva meta de ahorro'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Nombre" value={f.name} onChange={set('name')} placeholder="Fondo de emergencia, viaje…" required />
        <div className="row">
          <Input label="Meta (MXN)" type="number" min="1" step="0.01" inputMode="decimal" value={f.target} onChange={set('target')} required />
          <Input label="Ahorrado (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={f.current} onChange={set('current')} />
        </div>
        <Input label="Fecha límite" type="date" value={f.deadline} onChange={set('deadline')} />
        <div className="row">
          {goal && <button type="button" className="btn danger" onClick={async () => { await remove('goals', goal.id); onClose() }}><Icon name="trash" size={16} /></button>}
          <button className="btn" style={{ flex: 1 }}>Guardar</button>
        </div>
      </form>
    </Modal>
  )
}

function BudgetForm({ onClose }) {
  const { data, saveSettings } = useStore()
  const s = data.settings
  const [monthly, setMonthly] = useState(s.monthly_budget || '')
  const [cats, setCats] = useState(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, s.category_budgets?.[c.id] || ''])))
  const submit = async (e) => {
    e.preventDefault()
    const category_budgets = {}
    for (const [k, v] of Object.entries(cats)) if (num(v) > 0) category_budgets[k] = num(v)
    await saveSettings({ monthly_budget: num(monthly), category_budgets })
    onClose()
  }
  return (
    <Modal title="Presupuestos" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Presupuesto discrecional mensual (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        <h3>Por categoría (mensual)</h3>
        <div className="grid c2">
          {CATEGORIES.map((c) => (
            <Input key={c.id} label={c.label} type="number" min="0" step="1" inputMode="decimal" value={cats[c.id]} onChange={(e) => setCats({ ...cats, [c.id]: e.target.value })} placeholder="Sin límite" />
          ))}
        </div>
        <button className="btn block">Guardar</button>
      </form>
    </Modal>
  )
}

export default function Goals() {
  const { data, update, remove } = useStore()
  const { goals, settings, transactions, msi_plans, recurring, cards } = data
  const [goalModal, setGoalModal] = useState(null) // null | 'new' | goal
  const [budgetModal, setBudgetModal] = useState(false)
  const db = dailyBudget(settings, transactions, msi_plans)
  const byCat = monthSpendByCategory(transactions, msi_plans, monthKey(new Date()))
  const catBudgets = Object.entries(settings.category_budgets || {}).filter(([, v]) => num(v) > 0)

  return (
    <div className="page">
      <div className="card-head"><h1>Metas y presupuesto</h1><button className="btn sm ghost" onClick={() => setBudgetModal(true)}><Icon name="edit" size={16} /> Presupuestos</button></div>

      <div className="card">
        <div className="card-head"><h2>Presupuesto diario</h2><span className="muted small">{db.remainingDays} días restantes</span></div>
        {!db.budget ? <Empty>Define tu presupuesto discrecional mensual para ver tu gasto permitido por día.</Empty> : (
          <>
            <div className="grid c3">
              <div className="stat"><span className="label">Permitido hoy</span><span className="value num">{mxn(db.todayAllowance)}</span><span className="sub">base {mxn0(db.base)}/día</span></div>
              <div className="stat"><span className="label">Gastado hoy</span><span className={'value num ' + (db.leftToday < 0 ? 'neg' : '')}>{mxn(db.spentToday)}</span><span className="sub">{db.leftToday >= 0 ? `quedan ${mxn0(db.leftToday)}` : `excedido ${mxn0(-db.leftToday)}`}</span></div>
              <div className="stat"><span className="label">Acumulado del mes</span><span className={'value num ' + (db.surplus >= 0 ? 'pos' : 'neg')}>{db.surplus >= 0 ? '+' : '−'}{mxn(Math.abs(db.surplus))}</span><span className="sub">{db.surplus >= 0 ? 'superávit' : 'déficit'} hasta ayer</span></div>
            </div>
            <Progress value={db.spent} max={db.budget} color={db.spent > db.budget ? 'var(--critical)' : 'var(--accent)'} />
            <div className="row spread small"><span className="muted">Gastado {mxn(db.spent)} de {mxn(db.budget)}</span><span className="num">{Math.round((db.spent / db.budget) * 100)}%</span></div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Presupuesto por categoría</h2><span className="muted small">Este mes</span></div>
        {catBudgets.length === 0 ? <Empty>Asigna límites por categoría en “Presupuestos”.</Empty> : (
          <div className="row wrap" style={{ gap: 16, justifyContent: 'space-around' }}>
            {catBudgets.map(([cat, limit], i) => {
              const spent = byCat[cat] || 0
              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 100 }}>
                  <Ring value={spent} max={limit} color={SERIES[i % SERIES.length]} />
                  <div className="small" style={{ fontWeight: 600 }}>{catLabel(cat)}</div>
                  <div className="small muted num" style={{ textAlign: 'center' }}>{mxn0(spent)} / {mxn0(limit)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Metas de ahorro</h2><button className="btn sm" onClick={() => setGoalModal('new')}><Icon name="plus" size={16} /> Meta</button></div>
        {goals.length === 0 ? <Empty>Sin metas todavía.</Empty> : (
          <div className="list">
            {goals.map((g, i) => {
              const pct = num(g.target) > 0 ? Math.min(100, (num(g.current) / num(g.target)) * 100) : 0
              const dl = parseISO(g.deadline)
              const daysLeft = dl ? Math.ceil((dl - new Date()) / 86400000) : null
              const needPerMonth = dl && daysLeft > 0 ? (num(g.target) - num(g.current)) / Math.max(1, daysLeft / 30) : null
              return (
                <div className="item" key={g.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div className="row spread">
                    <div className="title">{g.name}</div>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn ghost sm" onClick={() => { const v = window.prompt('¿Cuánto abonas a esta meta?'); if (v && num(v) > 0) update('goals', g.id, { current: num(g.current) + num(v) }) }}>+ Abonar</button>
                      <button className="icon-btn" onClick={() => setGoalModal(g)}><Icon name="edit" size={16} /></button>
                    </div>
                  </div>
                  <Progress value={num(g.current)} max={num(g.target)} color={pct >= 100 ? 'var(--good)' : SERIES[i % SERIES.length]} />
                  <div className="row spread small">
                    <span className="num">{mxn(g.current)} / {mxn(g.target)} · {Math.round(pct)}%</span>
                    <span className="muted">{dl ? (daysLeft > 0 ? `${fmtDateLong(g.deadline)} · ${mxn0(needPerMonth)}/mes` : 'Vencida') : 'Sin fecha'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Pagos recurrentes</h2><span className="muted small">{mxn(recurring.filter((r) => r.active).reduce((a, r) => a + num(r.amount), 0))}/mes</span></div>
        {recurring.length === 0 ? <Empty>Agrega suscripciones y servicios con el botón + → Recurrente.</Empty> : (
          <div className="list">
            {recurring.map((r) => {
              const c = cards.find((c) => c.id === r.card_id)
              return (
                <div className="item" key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                  <span className="dot" style={{ background: c?.color || 'var(--muted)' }} />
                  <div className="main"><div className="title">{r.description}</div><div className="sub">Día {r.day_of_month} · {catLabel(r.category)} · {c?.name || 'Efectivo'}</div></div>
                  <span className="amt num">{mxn(r.amount)}</span>
                  <button className="btn ghost sm" onClick={() => update('recurring', r.id, { active: !r.active })}>{r.active ? 'Pausar' : 'Activar'}</button>
                  <button className="icon-btn" onClick={() => window.confirm('¿Eliminar pago recurrente?') && remove('recurring', r.id)}><Icon name="trash" size={16} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {goalModal && <GoalForm goal={goalModal === 'new' ? null : goalModal} onClose={() => setGoalModal(null)} />}
      {budgetModal && <BudgetForm onClose={() => setBudgetModal(false)} />}
    </div>
  )
}
