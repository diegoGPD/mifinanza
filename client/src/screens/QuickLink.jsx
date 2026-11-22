import { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import { api } from '../api.js'
import { Icon } from '../ui.jsx'

function CopyRow({ label, value }) {
  const [ok, setOk] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200) } catch {}
  }
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="row">
        <input readOnly value={value} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
        <button type="button" className="btn ghost sm" onClick={copy}>{ok ? 'Copiado' : 'Copiar'}</button>
      </div>
    </div>
  )
}

export default function QuickLink() {
  const { data } = useStore()
  const [token, setToken] = useState(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.get('/api/quick/token').then((r) => setToken(r.token)).catch(() => setToken(null)) }, [])

  const generate = async () => {
    if (token && !window.confirm('El enlace actual dejará de funcionar. ¿Generar uno nuevo?')) return
    setBusy(true)
    try { setToken((await api.post('/api/quick/token')).token) } finally { setBusy(false) }
  }
  const revoke = async () => {
    if (!window.confirm('¿Desactivar el enlace rápido?')) return
    await api.del('/api/quick/token'); setToken(null)
  }

  const base = `${location.origin}/api/quick/${token}`
  const card = data.cards[0]
  const ex = card ? `${base}?monto=250&desc=Oxxo&tarjeta=${card.last4 || encodeURIComponent(card.name)}&categoria=comida` : `${base}?monto=250&desc=Oxxo`

  return (
    <>
      <h3>Enlace rápido</h3>
      <div className="muted small">Registra movimientos sin abrir la app: desde Atajos de iOS, una automatización o un marcador. Trátalo como contraseña: cualquiera con el enlace puede agregar movimientos (no ver tus datos).</div>
      {token === undefined ? <div className="muted small">Cargando…</div> : !token ? (
        <button className="btn ghost block" onClick={generate} disabled={busy}>Generar enlace</button>
      ) : (
        <>
          <CopyRow label="Tu enlace" value={base} />
          <CopyRow label="Ejemplo (ábrelo para probar)" value={ex} />
          <div className="card flat small" style={{ gap: 4 }}>
            <b>Parámetros</b>
            <span><code>monto</code> (obligatorio) · <code>desc</code> · <code>tarjeta</code> (últimos 4 o nombre; opcional si tienes una sola)</span>
            <span><code>categoria</code>: comida, transporte, entretenimiento, servicios, salud, ropa, hogar, educacion, otros</span>
            <span><code>tipo</code>: compra (default), pago / deposito, ingreso · <code>fecha</code>: AAAA-MM-DD (default hoy)</span>
            <span className="muted">Acepta GET con parámetros o POST con JSON. Responde JSON, o una página de confirmación si lo abres en el navegador.</span>
          </div>
          <div className="row">
            <button className="btn ghost sm" onClick={generate} disabled={busy}>Regenerar</button>
            <button className="btn danger sm" onClick={revoke}>Desactivar</button>
          </div>
        </>
      )}
      <CopyRow label="Acceso directo a “Registrar” (agrégalo a tu pantalla de inicio)" value={`${location.origin}/#registrar`} />
    </>
  )
}
