import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Modal, Input, Select, Segmented } from '../ui.jsx'
import { CATEGORIES, todayISO, mxn, num } from '../lib.js'
import { msiPlanFromExisting } from './Cards.jsx'

const MSI_OPTIONS = [3, 6, 9, 12, 18, 24]

export default function QuickAdd({ onClose, defaultCard }) {
  const { data, create } = useStore()
  const { cards } = data
  const credit = cards.filter((c) => c.type === 'credit')
  const [kind, setKind] = useState('purchase')
  const [f, setF] = useState({
    card_id: defaultCard || cards[0]?.id || '', amount: '', description: '', category: 'comida', date: todayISO(),
    months: 6, charged: 0, day_of_month: new Date().getDate(),
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const cardOpts = (list) => [...(kind === 'income' || kind === 'recurring' ? [{ value: '', label: 'Sin tarjeta / efectivo' }] : []), ...list.map((c) => ({ value: c.id, label: `${c.name} ${c.last4 ? '•••• ' + c.last4 : ''}` }))]

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const amount = num(f.amount)
    if (amount <= 0) { setErr('Ingresa un monto válido'); setBusy(false); return }
    const card_id = f.card_id ? Number(f.card_id) : null
    try {
      if (kind === 'msi') {
        if (!card_id) throw new Error('Selecciona una tarjeta de crédito')
        if (num(f.charged) > 0) await create('msi_plans', msiPlanFromExisting(card_id, { description: f.description, category: f.category, total: amount, months: Number(f.months), charged: num(f.charged) }))
        else await create('msi_plans', { card_id, description: f.description, category: f.category, total: amount, months: Number(f.months), start_date: f.date, paid_installments: 0 })
      } else if (kind === 'recurring') {
        await create('recurring', { card_id, description: f.description || 'Suscripción', amount, category: f.category, day_of_month: Number(f.day_of_month), active: true })
      } else {
        if (kind !== 'income' && !card_id) throw new Error('Selecciona una tarjeta')
        await create('transactions', { card_id, amount, description: f.description, category: kind === 'income' ? 'ingreso' : f.category, kind, date: f.date })
      }
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const monthly = kind === 'msi' && num(f.amount) > 0 ? num(f.amount) / Number(f.months) : 0

  return (
    <Modal title="Registrar" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Segmented value={kind} onChange={(v) => { setKind(v); setF({ ...f, card_id: v === 'msi' ? (credit[0]?.id || '') : f.card_id }) }} options={[
          { value: 'purchase', label: 'Compra' }, { value: 'msi', label: 'MSI' }, { value: 'payment', label: 'Pago/Depósito' }, { value: 'recurring', label: 'Recurrente' }, { value: 'income', label: 'Ingreso' },
        ]} />
        <Input label="Monto (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={set('amount')} autoFocus required />
        {kind !== 'income' && <Select label={kind === 'payment' ? 'Tarjeta (pago a crédito o depósito a débito)' : 'Tarjeta'} value={f.card_id} onChange={set('card_id')} options={cardOpts(kind === 'msi' ? credit : cards)} />}
        <Input label={kind === 'income' ? 'Concepto' : kind === 'payment' ? 'Nota' : 'Comercio / descripción'} value={f.description} onChange={set('description')} placeholder={kind === 'recurring' ? 'Netflix, luz, gym…' : ''} />
        {(kind === 'purchase' || kind === 'msi' || kind === 'recurring') && (
          <Select label="Categoría" value={f.category} onChange={set('category')} options={CATEGORIES} />
        )}
        {kind === 'msi' && (
          <>
            <div className="field">
              <label>Meses sin intereses</label>
              <div className="seg">{MSI_OPTIONS.map((m) => <button type="button" key={m} className={Number(f.months) === m ? 'active' : ''} onClick={() => setF({ ...f, months: m })}>{m}</button>)}</div>
            </div>
            {monthly > 0 && <div className="muted small">Mensualidad: <b className="num">{mxn(monthly)}</b> × {f.months} meses</div>}
            <Input label="Mensualidades ya cobradas (0 si es compra nueva)" type="number" min="0" max={f.months} inputMode="numeric" value={f.charged} onChange={set('charged')} />
          </>
        )}
        {kind === 'recurring' ? (
          <Input label="Día del mes en que se cobra" type="number" min="1" max="31" value={f.day_of_month} onChange={set('day_of_month')} />
        ) : (
          (kind !== 'msi' || num(f.charged) === 0) && <Input label={kind === 'msi' ? 'Fecha de la primera mensualidad' : 'Fecha'} type="date" value={f.date} onChange={set('date')} required />
        )}
        {err && <div className="error">{err}</div>}
        <button className="btn block" disabled={busy}>Guardar</button>
      </form>
    </Modal>
  )
}
