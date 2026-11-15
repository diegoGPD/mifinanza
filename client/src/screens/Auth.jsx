import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Input } from '../ui.jsx'

export default function Auth() {
  const { login, register } = useStore()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await (mode === 'login' ? login(email, password) : register(email, password))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <div className="brand"><span className="logo">$</span> MiFinanza</div>
        <p className="muted small" style={{ margin: 0 }}>
          {mode === 'login' ? 'Inicia sesión para ver tus finanzas.' : 'Crea tu cuenta. Tus datos quedan guardados en la nube.'}
        </p>
        <Input label="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Contraseña" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {err && <div className="error">{err}</div>}
        <button className="btn block" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
        <button type="button" className="btn ghost block" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  )
}
