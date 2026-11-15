import { useState, useRef } from 'react'
import { useStore } from '../store.jsx'
import { Modal, Input, Segmented, Icon } from '../ui.jsx'
import { api } from '../api.js'
import { mxn, num, hourlyRate } from '../lib.js'

export default function Settings({ onClose }) {
  const { data, saveSettings, logout, reload, user } = useStore()
  const s = data.settings
  const [f, setF] = useState({ monthly_income: s.monthly_income || '', hourly_rate: s.hourly_rate || '', hours_per_week: s.hours_per_week || 40 })
  const [mode, setMode] = useState(num(s.hourly_rate) > 0 ? 'hourly' : 'salary')
  const [msg, setMsg] = useState('')
  const fileRef = useRef()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    await saveSettings({ monthly_income: num(f.monthly_income), hourly_rate: mode === 'hourly' ? num(f.hourly_rate) : 0, hours_per_week: num(f.hours_per_week) || 40 })
    setMsg('Guardado')
    setTimeout(() => setMsg(''), 1500)
  }

  const exportJson = async () => {
    const d = await api.get('/api/export')
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mifinanza-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importJson = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.confirm('Esto reemplazará todos tus datos actuales con los del respaldo. ¿Continuar?')) return
    try {
      const json = JSON.parse(await file.text())
      await api.post('/api/import', json)
      await reload()
      setMsg('Respaldo importado')
    } catch (err) { setMsg('Error: ' + err.message) }
    e.target.value = ''
  }

  return (
    <Modal title="Ajustes" onClose={onClose}>
      <div className="row spread">
        <span className="small muted">{user?.email}</span>
        <Segmented value={s.theme || 'dark'} onChange={(v) => saveSettings({ theme: v })} options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} />
      </div>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3>Ingresos</h3>
        <Input label="Salario mensual (MXN)" type="number" min="0" step="0.01" inputMode="decimal" value={f.monthly_income} onChange={set('monthly_income')} />
        <Segmented value={mode} onChange={setMode} options={[{ value: 'salary', label: 'Hora según salario' }, { value: 'hourly', label: 'Tarifa por hora' }]} />
        {mode === 'salary' ? (
          <Input label="Horas por semana" type="number" min="1" max="100" value={f.hours_per_week} onChange={set('hours_per_week')} />
        ) : (
          <Input label="Tarifa por hora (MXN)" type="number" min="0" step="0.01" value={f.hourly_rate} onChange={set('hourly_rate')} />
        )}
        <div className="muted small">Tu hora vale ≈ {mxn(mode === 'hourly' ? num(f.hourly_rate) : hourlyRate({ monthly_income: f.monthly_income, hours_per_week: f.hours_per_week, hourly_rate: 0 }))}</div>
        <button className="btn block">Guardar</button>
        {msg && <div className="small pos">{msg}</div>}
      </form>
      <div className="sep" />
      <h3>Respaldo</h3>
      <div className="row">
        <button className="btn ghost" style={{ flex: 1 }} onClick={exportJson}><Icon name="down" size={16} /> Exportar JSON</button>
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => fileRef.current.click()}><Icon name="up" size={16} /> Importar JSON</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJson} />
      </div>
      <div className="sep" />
      <button className="btn danger block" onClick={logout}><Icon name="out" size={16} /> Cerrar sesión</button>
    </Modal>
  )
}
