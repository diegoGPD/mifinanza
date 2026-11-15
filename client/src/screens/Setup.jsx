import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Input, Segmented } from '../ui.jsx'
import { CardForm } from './Cards.jsx'
import { mxn } from '../lib.js'

export default function Setup() {
  const { data, saveSettings } = useStore()
  const [step, setStep] = useState(1)
  const [income, setIncome] = useState(data.settings?.monthly_income || '')
  const [mode, setMode] = useState('salary')
  const [hourly, setHourly] = useState('')
  const [hpw, setHpw] = useState(40)
  const [budget, setBudget] = useState('')
  const [err, setErr] = useState('')

  const next = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await saveSettings({
        monthly_income: Number(income) || 0,
        hourly_rate: mode === 'hourly' ? Number(hourly) || 0 : 0,
        hours_per_week: Number(hpw) || 40,
        monthly_budget: Number(budget) || 0,
      })
      setStep(2)
    } catch (e) { setErr(e.message) }
  }

  const finish = async () => {
    await saveSettings({ setup_done: true })
  }

  const estHourly = Number(income) > 0 ? Number(income) / ((Number(hpw) || 40) * 52 / 12) : 0

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="brand" style={{ marginTop: 20 }}><span className="logo">$</span> MiFinanza</div>
      <div className="muted small">Paso {step} de 2</div>

      {step === 1 && (
        <form className="card" onSubmit={next}>
          <h2>Tus ingresos</h2>
          <Input label="Salario mensual (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} required />
          <Input label="Presupuesto discrecional mensual (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Lo que puedes gastar libremente al mes" />
          <h3>Valor de tu hora de trabajo</h3>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'salary', label: 'Calcular del salario' }, { value: 'hourly', label: 'Tarifa por hora' }]} />
          {mode === 'salary' ? (
            <>
              <Input label="Horas por semana" type="number" min="1" max="100" value={hpw} onChange={(e) => setHpw(e.target.value)} />
              <div className="muted small">≈ {mxn(estHourly)} por hora</div>
            </>
          ) : (
            <Input label="Tarifa por hora (MXN)" type="number" min="0" step="0.01" value={hourly} onChange={(e) => setHourly(e.target.value)} required />
          )}
          {err && <div className="error">{err}</div>}
          <button className="btn block">Continuar</button>
        </form>
      )}

      {step === 2 && (
        <div className="card">
          <h2>Agrega tu primera tarjeta</h2>
          {data.cards.length === 0 ? (
            <CardForm onDone={() => {}} />
          ) : (
            <>
              <div className="list">
                {data.cards.map((c) => (
                  <div className="item" key={c.id}>
                    <span className="dot" style={{ background: c.color }} />
                    <div className="main"><div className="title">{c.name}</div><div className="sub">{c.bank} •••• {c.last4}</div></div>
                  </div>
                ))}
              </div>
              <button className="btn block" onClick={finish}>Ir al inicio</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
