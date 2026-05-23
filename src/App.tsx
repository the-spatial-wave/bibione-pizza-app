import { useState, useEffect, useCallback } from 'react'
import { db, isFirebaseConfigured } from './firebase'
import { ref, onValue, set, remove } from 'firebase/database'
import './App.css'

const STAFF: string[] = Array.from({ length: 25 }, (_, i) => `Persona ${i + 1}`)

const PIZZAS = [
  'Margherita', 'Diavola', '4 Formaggi', 'Bianca con Salsiccia',
  'Bianca Salsiccia e Funghi', 'Bianca Salsiccia e Patate',
  'Tonno', 'Prosciutto e Pomodorini', 'Marinara', 'Capricciosa',
  'Gorgonzola e Salame Piccante',
]

const EXCLUDED_INGREDIENTS = [
  'Crudo', 'Bufala', 'Gamberetti', 'Burrata', 'Porcini', 'Bresaola',
]

type Orders = Record<string, string>

export default function App() {
  const [orders, setOrders] = useState<Orders>({})
  const [sessionOpen, setSessionOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [basePizza, setBasePizza] = useState<string | null>(null)
  const [aggiunte, setAggiunte] = useState('')
  const [customFree, setCustomFree] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const finalOrder = basePizza
    ? aggiunte.trim()
      ? `${basePizza} con ${aggiunte.trim()}`
      : basePizza
    : customFree.trim()

  useEffect(() => {
    if (isFirebaseConfigured && db) {
      onValue(ref(db, 'orders'), snap => setOrders(snap.val() || {}))
      onValue(ref(db, 'sessionOpen'), snap => setSessionOpen(snap.val() ?? false))
      return
    }
    const saved = localStorage.getItem('pizza-orders')
    if (saved) {
      try { setOrders(JSON.parse(saved)) } catch { /* ignore */ }
    }
    const savedSession = localStorage.getItem('pizza-session-open')
    if (savedSession !== null) {
      setSessionOpen(savedSession === 'true')
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      localStorage.setItem('pizza-orders', JSON.stringify(orders))
    }
  }, [orders])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      localStorage.setItem('pizza-session-open', String(sessionOpen))
    }
  }, [sessionOpen])

  const toggleSession = async () => {
    if (sessionOpen) {
      if (!confirm('Chiudere la sessione? Nessuno potrà più ordinare.')) return
    } else {
      if (Object.keys(orders).length > 0) {
        if (!confirm('Aprire una nuova sessione? Gli ordini precedenti verranno cancellati.')) return
        if (isFirebaseConfigured && db) {
          await remove(ref(db, 'orders'))
        } else {
          setOrders({})
        }
      }
    }
    const newState = !sessionOpen
    if (isFirebaseConfigured && db) {
      await set(ref(db, 'sessionOpen'), newState)
    } else {
      setSessionOpen(newState)
    }
  }

  const openModal = (name: string) => {
    if (!sessionOpen) return
    setSelected(name)
    setBasePizza(null)
    setAggiunte('')
    setCustomFree('')
  }

  const selectBase = (pizza: string) => {
    setBasePizza(pizza === basePizza ? null : pizza)
    setCustomFree('')
  }

  const submitOrder = useCallback(async () => {
    if (!selected || !finalOrder) return
    if (isFirebaseConfigured && db) {
      await set(ref(db, `orders/${selected}`), finalOrder)
    } else {
      setOrders(prev => ({ ...prev, [selected]: finalOrder }))
    }
    setFlash(selected)
    setSelected(null)
    setBasePizza(null)
    setAggiunte('')
    setCustomFree('')
    setTimeout(() => setFlash(null), 1200)
  }, [selected, finalOrder])

  const removeOrder = useCallback(async () => {
    if (!selected) return
    if (isFirebaseConfigured && db) {
      await remove(ref(db, `orders/${selected}`))
    } else {
      setOrders(prev => {
        const next = { ...prev }
        delete next[selected]
        return next
      })
    }
    setSelected(null)
  }, [selected])

  const summary = Object.values(orders).reduce<Record<string, number>>((acc, p) => {
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})
  const sorted = Object.entries(summary).sort((a, b) => b[1] - a[1])
  const total = Object.keys(orders).length

  return (
    <div className="app">
      <header className="header">
        <div className="hero-emoji">🍕</div>
        <h1>Pizza Night</h1>
        <p className="subtitle">Bibione Staff</p>
        <div className={`session-badge ${sessionOpen ? 'open' : 'closed'}`}>
          {sessionOpen ? '🟢 Sessione aperta — ordina!' : '🔴 Sessione chiusa'}
        </div>
        {sessionOpen && (
          <div className="counter-pill">
            <span className="counter-num">{total}</span>
            <span className="counter-sep">/</span>
            <span className="counter-den">{STAFF.length}</span>
          </div>
        )}
        {!isFirebaseConfigured && <span className="demo-badge">demo locale</span>}
      </header>

      {!sessionOpen && total === 0 && (
        <div className="closed-message">
          <p>La sessione è chiusa.</p>
          <p>Quando il pizzaiolo apre una nuova sessione potrai ordinare la tua pizza.</p>
        </div>
      )}

      {(sessionOpen || total > 0) && (
        <section className="grid">
          {STAFF.map((name, i) => (
            <button
              key={name}
              className={`card${orders[name] ? ' done' : ''}${flash === name ? ' flash' : ''}${!sessionOpen ? ' disabled' : ''}`}
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => openModal(name)}
            >
              <span className="card-icon">{orders[name] ? '🍕' : '👤'}</span>
              <span className="card-name">{name}</span>
              {orders[name] && <span className="card-pizza">{orders[name]}</span>}
            </button>
          ))}
        </section>
      )}

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            <h2>🍕 {selected}</h2>

            {orders[selected] && (
              <div className="current-order">
                Ordine attuale: <strong>{orders[selected]}</strong>
              </div>
            )}

            <div className="excluded-notice">
              <strong>⚠️ Ingredienti NON compresi:</strong>{' '}
              {EXCLUDED_INGREDIENTS.join(', ')}
            </div>

            <p className="modal-label">1. Scegli la base</p>

            <div className="pizza-grid">
              {PIZZAS.map(p => (
                <button
                  key={p}
                  className={`pizza-btn${basePizza === p ? ' selected' : ''}`}
                  onClick={() => selectBase(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            {basePizza && (
              <div className="aggiunte-section">
                <p className="modal-label">2. Aggiunte? (opzionale)</p>
                <input
                  type="text"
                  className="aggiunte-input"
                  placeholder="es. patatine, funghi, senza mozzarella..."
                  value={aggiunte}
                  onChange={e => setAggiunte(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitOrder()}
                />
              </div>
            )}

            <div className="separator">
              <span>oppure scrivi a mano</span>
            </div>

            <div className="custom-row">
              <input
                type="text"
                placeholder="Pizza personalizzata..."
                value={customFree}
                onChange={e => { setCustomFree(e.target.value); setBasePizza(null); setAggiunte('') }}
                onKeyDown={e => e.key === 'Enter' && submitOrder()}
              />
            </div>

            {finalOrder && (
              <div className="order-preview">
                🍕 <strong>{finalOrder}</strong>
              </div>
            )}

            <button
              className="submit-btn"
              onClick={submitOrder}
              disabled={!finalOrder}
            >
              Ordina
            </button>

            {orders[selected] && (
              <button className="remove-btn" onClick={removeOrder}>
                Rimuovi ordine
              </button>
            )}
          </div>
        </div>
      )}

      <section className="summary">
        <h2>📋 Riepilogo Pizzaiolo</h2>

        {sorted.length === 0 ? (
          <p className="empty">Nessun ordine ancora...</p>
        ) : (
          <div className="summary-bars">
            {sorted.map(([pizza, count]) => (
              <div key={pizza} className="bar-row">
                <span className="bar-label">{pizza}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
                <span className="bar-count">&times;{count}</span>
              </div>
            ))}
          </div>
        )}

        <p className="summary-total">
          Totale: <strong>{total}</strong> pizze ordinate
        </p>

        {total > 0 && (
          <div className="detail-list">
            <h3>Dettaglio ordini</h3>
            {Object.entries(orders)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, pizza]) => (
                <div key={name} className="detail-row">
                  <span>{name}</span>
                  <span className="detail-pizza">{pizza}</span>
                </div>
              ))}
          </div>
        )}

        <button
          className={`session-toggle ${sessionOpen ? 'is-open' : 'is-closed'}`}
          onClick={toggleSession}
        >
          {sessionOpen ? '🔒 Chiudi Sessione' : '🔓 Apri Nuova Sessione'}
        </button>
      </section>

      <footer className="footer">
        Pizza Night &mdash; Bibione Staff App
      </footer>
    </div>
  )
}
