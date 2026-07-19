import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import NavLogo from '../components/NavLogo.jsx'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function pct(val) {
  if (val == null) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

export default function AccountPage() {
  const { user, credits, signOutUser, getIdToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const showSuccess = searchParams.get('success') === '1'

  useEffect(() => {
    if (!user) return
    setHistLoading(true)
    getIdToken().then((token) =>
      fetch('/api/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    ).then(r => r.json())
      .then(d => setHistory(d.backtests || []))
      .catch(() => {})
      .finally(() => setHistLoading(false))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d1117', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif", color: '#e6edf3',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#8b949e', marginBottom: 16 }}>You need to sign in to view your account.</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              border: 'none', color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      fontFamily: "'Space Grotesk', sans-serif",
      color: '#e6edf3',
      padding: '60px 24px 80px',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <NavLogo />
          <button
            onClick={signOutUser}
            style={{
              background: 'none', border: '1px solid #30363d',
              color: '#8b949e', fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', borderRadius: 8, padding: '6px 14px',
            }}
          >
            Sign out
          </button>
        </div>

        {/* Success toast */}
        {showSuccess && (
          <div style={{
            background: 'rgba(52,211,153,0.1)',
            border: '1px solid rgba(52,211,153,0.3)',
            borderRadius: 10,
            padding: '12px 18px',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            color: '#34d399',
          }}>
            <span style={{ fontSize: 18 }}>✓</span>
            Credits added to your account! Your balance has been updated.
          </div>
        )}

        {/* Profile + credits card */}
        <div style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 24,
        }}>
          <div>
            <p style={{ fontSize: 12, color: '#8b949e', letterSpacing: '0.07em', margin: '0 0 4px' }}>SIGNED IN AS</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3', margin: 0 }}>{user.email}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: '#8b949e', letterSpacing: '0.07em', margin: '0 0 4px' }}>CREDITS REMAINING</p>
            <div style={{
              fontSize: 42,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}>
              {credits ?? '—'}
            </div>
          </div>
        </div>


        {/* Backtest history */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3', marginBottom: 16 }}>
            Recent Backtests
          </h2>

          {histLoading ? (
            <p style={{ color: '#484f58', fontSize: 14 }}>Loading…</p>
          ) : history.length === 0 ? (
            <div style={{
              background: '#161b22', border: '1px solid #30363d',
              borderRadius: 12, padding: '24px',
              textAlign: 'center', color: '#484f58', fontSize: 14,
            }}>
              No backtests yet. Go run your first strategy!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((bt) => (
                <div
                  key={bt.id}
                  style={{
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: 12,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onClick={() => navigate('/', { state: { selectedSummary: bt.summary, selectedDownloadId: bt.download_id, selectedStrategy: bt.strategy } })}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#38bdf8'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: '#e6edf3',
                      margin: '0 0 3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {bt.strategy || 'Strategy'}
                    </p>
                    <p style={{ fontSize: 11, color: '#484f58', margin: 0 }}>{formatDate(bt.created_at)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: '#484f58', margin: '0 0 2px', letterSpacing: '0.06em' }}>RETURN</p>
                      <p style={{
                        fontSize: 13, fontWeight: 700, margin: 0,
                        color: (bt.total_return_pct ?? 0) >= 0 ? '#34d399' : '#f87171',
                      }}>
                        {pct(bt.total_return_pct)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: '#484f58', margin: '0 0 2px', letterSpacing: '0.06em' }}>CAGR</p>
                      <p style={{
                        fontSize: 13, fontWeight: 700, margin: 0,
                        color: (bt.cagr_pct ?? 0) >= 0 ? '#34d399' : '#f87171',
                      }}>
                        {pct(bt.cagr_pct)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, color: '#484f58', margin: '0 0 2px', letterSpacing: '0.06em' }}>SHARPE</p>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#e6edf3' }}>
                        {bt.sharpe_ratio != null ? bt.sharpe_ratio.toFixed(2) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
