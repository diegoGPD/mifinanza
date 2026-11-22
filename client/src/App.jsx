import { useEffect, useState } from 'react'
import { useStore } from './store.jsx'
import { Icon } from './ui.jsx'
import Auth from './screens/Auth.jsx'
import Setup from './screens/Setup.jsx'
import Dashboard from './screens/Dashboard.jsx'
import Cards from './screens/Cards.jsx'
import Calendar from './screens/Calendar.jsx'
import Goals from './screens/Goals.jsx'
import QuickAdd from './screens/QuickAdd.jsx'
import Simulator from './screens/Simulator.jsx'
import Settings from './screens/Settings.jsx'

const TABS = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'cards', label: 'Tarjetas', icon: 'card' },
  { id: 'calendar', label: 'Calendario', icon: 'cal' },
  { id: 'goals', label: 'Metas', icon: 'target' },
]

export default function App() {
  const { user, data, theme, saveSettings } = useStore()
  const [tab, setTab] = useState('home')
  const [cardId, setCardId] = useState(null)
  const [add, setAdd] = useState(false)
  const [sim, setSim] = useState(false)
  const [settings, setSettings] = useState(false)

  // Acceso directo: /#registrar abre el formulario de registro
  const ready = !!(user && data.settings?.setup_done)
  useEffect(() => {
    if (!ready) return
    const check = () => {
      if (location.hash === '#registrar') { setAdd(true); history.replaceState(null, '', location.pathname) }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [ready])

  if (user === undefined || (user && !data.settings)) return <div className="auth"><div className="muted">Cargando…</div></div>
  if (!user) return <Auth />
  if (!data.settings.setup_done) return <Setup />

  const openCard = (id) => { setCardId(id); setTab('cards') }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">$</span> MiFinanza</div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" onClick={() => saveSettings({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Cambiar tema"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Ajustes"><Icon name="gear" /></button>
        </div>
      </header>

      {tab === 'home' && <Dashboard onOpenCard={openCard} />}
      {tab === 'cards' && <Cards selectedId={cardId} onSelect={setCardId} />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'goals' && <Goals />}

      <button className="fab sim" onClick={() => setSim(true)} aria-label="Simulador"><Icon name="calc" size={24} /></button>
      <button className="fab add" onClick={() => setAdd(true)} aria-label="Registrar"><Icon name="plus" size={26} /></button>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); if (t.id === 'cards') setCardId(null) }}>
            <Icon name={t.icon} /><span>{t.label}</span>
          </button>
        ))}
      </nav>

      {add && <QuickAdd onClose={() => setAdd(false)} defaultCard={cardId} />}
      {sim && <Simulator onClose={() => setSim(false)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}
