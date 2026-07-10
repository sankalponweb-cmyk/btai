import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'

function pct(val) {
  if (val == null) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

function formatDate(ts) {
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

export default function HistoryPanel({ onSelectBacktest }) {
  const { user } = useAuth()
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'users', user.uid, 'backtests'),
      orderBy('created_at', 'desc'),
      limit(10),
    )

    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return unsub
  }, [user])

  if (!user || history.length === 0) return null

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 760,
        marginTop: 40,
      }}
    >
      <p style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#484f58',
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        RECENT BACKTESTS
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((bt) => {
          const metrics = (bt.summary || {}).metrics || {}
          return (
            <button
              key={bt.id}
              onClick={() => onSelectBacktest && onSelectBacktest(bt.summary)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
                textAlign: 'left',
                width: '100%',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'
                e.currentTarget.style.background = 'rgba(56,189,248,0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 500, color: '#c9d1d9',
                  margin: '0 0 2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {bt.strategy || 'Strategy'}
                </p>
                <p style={{ fontSize: 11, color: '#484f58', margin: 0 }}>{formatDate(bt.created_at)}</p>
              </div>
              <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 9, color: '#484f58', margin: '0 0 1px', letterSpacing: '0.06em' }}>RETURN</p>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: (metrics.total_return_pct ?? 0) >= 0 ? '#34d399' : '#f87171' }}>
                    {pct(metrics.total_return_pct)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 9, color: '#484f58', margin: '0 0 1px', letterSpacing: '0.06em' }}>SHARPE</p>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: '#e6edf3' }}>
                    {metrics.sharpe_ratio != null ? metrics.sharpe_ratio.toFixed(2) : '—'}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
