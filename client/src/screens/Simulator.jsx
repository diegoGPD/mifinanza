import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { Modal, Input, Select, Segmented } from '../ui.jsx'
import { mxn, mxn0, num, cardBalance, msiSchedule, monthKey, dailyBudget, hourlyRate, fmtHours, daysInMonth } from '../lib.js'

const OPTIONS = [1, 3, 6, 9, 12, 18]

export default function Simulator({ onClose }) {
  const { data } = useStore()
  const { cards, transactions, msi_plans, settings } = data
  const credit = cards.filter((c) => c.type === 'credit')
  const [amount, setAmount] = useState('')
  const [cardId, setCardId] = useState(credit[0]?.id || cards[0]?.id || '')
  const [months, setMonths] = useState(1)
  const amt = num(amount)
  const card = cards.find((c) => c.id === Number(cardId))
  const rate = hourlyRate(settings)
  const db = dailyBudget(settings, transactions, msi_plans)

  const base = useMemo(() => {
    const bal = card ? cardBalance(card, transactions, msi_plans) : 0
    const limit = num(card?.credit_limit)
    const ym = monthKey(new Date())
    const msiMonth = msiSchedule(msi_plans).filter((s) => s.month === ym).reduce((a, s) => a + s.amount, 0)
    return { bal, limit, avail: limit - bal, msiMonth }
  }, [card, transactions, msi_plans])

  const sim = (m) => {
    const monthly = amt / m
    const firstCharge = m === 1 ? amt : monthly
    const newBal = base.bal + firstCharge
    const newAvail = base.limit - newBal
    const newMsi = base.msiMonth + (m > 1 ? monthly : 0)
    const dim = daysInMonth(new Date().getFullYear(), new Date().getMonth())
    const dailyHit = m === 1 ? amt : monthly / dim
    const newAllowance = m === 1 ? (db.budget - (db.spent - db.spentToday) - amt) / db.remainingDays : db.todayAllowance - monthly / dim
    return { m, monthly, firstCharge, newBal, newAvail, newMsi, dailyHit, newAllowance, hours: rate > 0 ? amt / rate : 0, hoursMonthly: rate > 0 ? monthly / rate : 0 }
  }
  const cur = sim(months)
  const isCredit = card?.type === 'credit'
  const pctLimit = base.limit > 0 ? (cur.newBal / base.limit) * 100 : 0

  return (
    <Modal title="Simulador de compra" onClose={onClose} wide>
      <div className="grid c2">
        <Input label="Monto de la compra (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        <Select label="Tarjeta" value={cardId} onChange={(e) => setCardId(e.target.value)} options={cards.map((c) => ({ value: c.id, label: `${c.name}${c.type === 'debit' ? ' (débito)' : ''}` }))} />
      </div>
      <div className="field">
        <label>Forma de pago</label>
        <div className="seg">{OPTIONS.map((m) => <button type="button" key={m} className={months === m ? 'active' : ''} onClick={() => setMonths(m)} disabled={m > 1 && !isCredit}>{m === 1 ? 'Una sola exhibición' : `${m} MSI`}</button>)}</div>
      </div>

      {amt > 0 && (
        <>
          <div className="grid c2">
            <div className="card flat stat">
              <span className="label">Horas de trabajo</span>
              <span className="value num">{rate > 0 ? fmtHours(cur.hours) : '—'}</span>
              <span className="sub">{rate > 0 ? `a ${mxn(rate)}/h${months > 1 ? ` · ${fmtHours(cur.hoursMonthly)} por mensualidad` : ''}` : 'Configura tu tarifa por hora en ajustes'}</span>
            </div>
            <div className="card flat stat">
              <span className="label">{months > 1 ? 'Mensualidad' : 'Cargo'}</span>
              <span className="value num">{mxn(cur.monthly)}</span>
              <span className="sub">{months > 1 ? `${months} meses · total ${mxn(amt)}` : 'una sola vez'}</span>
            </div>
          </div>

          <div className="card flat">
            <h3>Impacto</h3>
            <table className="tbl">
              <thead><tr><th></th><th>Ahora</th><th>Después</th></tr></thead>
              <tbody>
                {isCredit && <tr><td>Saldo de {card.name}</td><td className="num">{mxn(base.bal)}</td><td className="num">{mxn(cur.newBal)}</td></tr>}
                {isCredit && <tr><td>Crédito disponible</td><td className="num">{mxn(base.avail)}</td><td className={'num ' + (cur.newAvail < 0 ? 'neg' : '')}>{mxn(cur.newAvail)}</td></tr>}
                {isCredit && <tr><td>Uso del límite</td><td className="num">{base.limit ? Math.round((base.bal / base.limit) * 100) : 0}%</td><td className={'num ' + (pctLimit > 80 ? 'neg' : '')}>{Math.round(pctLimit)}%</td></tr>}
                <tr><td>MSI comprometidos / mes</td><td className="num">{mxn(base.msiMonth)}</td><td className="num">{mxn(cur.newMsi)}</td></tr>
                {db.budget > 0 && <tr><td>Permitido diario</td><td className="num">{mxn(db.todayAllowance)}</td><td className={'num ' + (cur.newAllowance < 0 ? 'neg' : '')}>{mxn(cur.newAllowance)}</td></tr>}
              </tbody>
            </table>
            {isCredit && cur.newAvail < 0 && <div className="error">Excede el límite de crédito por {mxn(-cur.newAvail)}.</div>}
            {months === 1 && db.budget > 0 && amt > db.remaining && <div className="error">Supera lo que te queda del presupuesto mensual ({mxn(db.remaining)}).</div>}
          </div>

          {isCredit && (
            <div className="card flat">
              <h3>Comparar opciones</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead><tr><th>Plazo</th><th>Mensual</th><th>Horas/mes</th><th>Disponible</th><th>MSI/mes</th><th>Termina</th></tr></thead>
                  <tbody>
                    {OPTIONS.map((m) => {
                      const s = sim(m)
                      const end = new Date(); end.setMonth(end.getMonth() + m - 1)
                      return (
                        <tr key={m} className={m === months ? 'hl' : ''} onClick={() => setMonths(m)} style={{ cursor: 'pointer' }}>
                          <td>{m === 1 ? 'Contado' : `${m} MSI`}</td>
                          <td className="num">{mxn0(s.monthly)}</td>
                          <td className="num">{rate > 0 ? fmtHours(s.hoursMonthly) : '—'}</td>
                          <td className={'num ' + (s.newAvail < 0 ? 'neg' : '')}>{mxn0(s.newAvail)}</td>
                          <td className="num">{mxn0(s.newMsi)}</td>
                          <td>{end.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="muted small">Al contado el saldo sube de golpe; a MSI el crédito se libera conforme pagas, pero compromete tu flujo mensual.</div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
