import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import HeroSection from './components/HeroSection.jsx'
import EarthCorner from './components/EarthCorner.jsx'
import SearchBar from './components/SearchBar.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import ResultsSummary from './components/ResultsSummary.jsx'
import DownloadPanel from './components/DownloadPanel.jsx'
import DemoSection from './components/DemoSection.jsx'
import LimitationsSection from './components/LimitationsSection.jsx'
import StrategyImprover from './components/StrategyImprover.jsx'
import NavLogo from './components/NavLogo.jsx'
import ExamplesSection from './components/ExamplesSection.jsx'
import SampleReportBanner from './components/SampleReportBanner.jsx'

const STATE = { IDLE: 'idle', LOADING: 'loading', RESULTS: 'results', ERROR: 'error' }

export default function App() {
  const { user, credits, loading: authLoading, signInWithGoogle, signOutUser, getIdToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [state,           setState]          = useState(STATE.IDLE)
  const [summary,         setSummary]        = useState(null)
  const [downloadId,      setDownloadId]     = useState(null)
  const [error,           setError]          = useState(null)
  const [activePanel,     setActivePanel]    = useState(null) // 'demo' | 'examples' | null
  const [fromAccount,     setFromAccount]    = useState(false)
  const [lastRunParams,   setLastRunParams]  = useState(null)
  const [showImprover,    setShowImprover]   = useState(false)

  // If navigated from AccountPage with a selected backtest, show results immediately
  useEffect(() => {
    const sel = location.state?.selectedSummary
    if (sel) {
      setSummary(sel)
      setDownloadId(location.state?.selectedDownloadId || null)
      setState(STATE.RESULTS)
      setFromAccount(true)
      if (location.state?.selectedStrategy) {
        setLastRunParams({ strategy: location.state.selectedStrategy, initialCapital: 1_000_000, startDate: null })
      }
      window.history.replaceState({}, '')
    }
  }, [])

  const handleSubmit = async ({ strategy, initialCapital, startDate }) => {
    setState(STATE.LOADING)
    setError(null)
    setSummary(null)
    setDownloadId(null)
    setFromAccount(false)
    setShowImprover(false)
    setLastRunParams({ strategy, initialCapital, startDate })

    try {
      const token = await getIdToken()
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          strategy,
          initial_capital: initialCapital,
          start_date: startDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = data.detail
        if (detail && typeof detail === 'object') {
          setError(detail)
        } else {
          setError({
            headline: 'Backtesting hit a roadblock',
            detail: typeof detail === 'string' ? detail : `Server error ${res.status}`,
            suggestion: 'Try rephrasing your strategy or simplifying the entry/exit conditions.',
          })
        }
        setState(STATE.ERROR)
        return
      }

      const data = await res.json()
      setSummary(data.summary)
      setDownloadId(data.download_id)
      setState(STATE.RESULTS)
    } catch {
      setError({
        headline: 'Connection error',
        detail: 'Could not reach the backtesting server.',
        suggestion: 'Make sure the backend is running (uvicorn main:app --port 8000) and try again.',
      })
      setState(STATE.ERROR)
    }
  }

  const handleReset = () => {
    setState(STATE.IDLE)
    setSummary(null)
    setDownloadId(null)
    setError(null)
    setLastRunParams(null)
  }

  const handleRerun = (revisedStrategy) => {
    const params = lastRunParams || {}
    handleSubmit({
      strategy: revisedStrategy,
      initialCapital: params.initialCapital || 1_000_000,
      startDate: params.startDate || null,
    })
  }

  const handleSelectBacktest = (savedSummary) => {
    if (!savedSummary) return
    setSummary(savedSummary)
    setDownloadId(null)
    setState(STATE.RESULTS)
  }

  const isNoCredits = error?.cta === 'Buy Credits'

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <HeroSection />
      <EarthCorner />
      {state === STATE.LOADING && <LoadingScreen />}

      {/* Top-left logo — shown only on results screen (not on landing page) */}
      {state === STATE.RESULTS && (
        <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 50 }}>
          <NavLogo onClick={handleReset} />
        </div>
      )}

      {/* Top-right user bar */}
      {!authLoading && user && (
        <div style={{
          position: 'fixed',
          top: 16,
          right: 20,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {credits !== null && (
            <span
              onClick={() => navigate('/buy-credits')}
              style={{
                fontSize: 12,
                color: credits === 0 ? '#f87171' : '#38bdf8',
                background: credits === 0 ? 'rgba(248,113,113,0.1)' : 'rgba(56,189,248,0.1)',
                border: `1px solid ${credits === 0 ? 'rgba(248,113,113,0.25)' : 'rgba(56,189,248,0.2)'}`,
                borderRadius: 20,
                padding: '4px 12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{credits}</span> Credits Remaining
            </span>
          )}
          <button
            onClick={() => navigate('/account')}
            style={{
              background: 'rgba(22,27,34,0.9)',
              border: '1px solid #30363d',
              borderRadius: 8,
              color: '#8b949e',
              fontSize: 12,
              padding: '4px 12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Account
          </button>
          <button
            onClick={signOutUser}
            style={{
              background: 'none',
              border: 'none',
              color: '#484f58',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '4px 4px',
            }}
          >
            Sign out
          </button>
        </div>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          width: '100%',
          padding: '0 24px 80px',
          boxSizing: 'border-box',
        }}
      >
        {/* Hero + search — idle or error */}
        {(state === STATE.IDLE || state === STATE.ERROR) && (
          <div
            className="fade-in"
            style={{ textAlign: 'center', padding: '80px 0 48px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div style={{
              display: 'inline-block',
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid rgba(56,189,248,0.35)',
              fontSize: 13,
              background: 'rgba(56,189,248,0.07)',
              marginBottom: 24,
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}>
                ✦ AI-Powered Backtesting — No Code Required
              </span>
            </div>
            <h1 style={{
              fontSize: 'clamp(32px, 5vw, 58px)',
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: 20,
              background: 'linear-gradient(135deg, #e6edf3 0%, #38bdf8 60%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}>
              Backtest.ai
            </h1>

            {/* Auth gate */}
            {!authLoading && !user ? (
              <>
              <div style={{ marginTop: 8 }}>
                {/* Flow steps */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, flexWrap: 'wrap', marginBottom: 24,
                }}>
                  {[
                    'Describe your strategy in English',
                    'Backtested on real historical data',
                    'Detailed analysis report',
                  ].map((step, i, arr) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 13, color: '#e6edf3',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 20, padding: '5px 14px',
                        whiteSpace: 'nowrap',
                      }}>
                        {step}
                      </span>
                      {i < arr.length - 1 && (
                        <span style={{ color: '#38bdf8', fontSize: 14, fontWeight: 700 }}>→</span>
                      )}
                    </div>
                  ))}
                </div>
                <p style={{ color: '#e6edf3', fontSize: 15, marginBottom: 28 }}>
                  Sign in to run your first backtest — 3 free credits on signup.
                </p>
                <button
                  onClick={signInWithGoogle}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '13px 28px',
                    borderRadius: 12,
                    border: '1px solid #30363d',
                    background: '#161b22',
                    color: '#e6edf3',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s, background 0.2s',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.background = 'rgba(56,189,248,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.background = '#161b22' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              </div>
              {/* Sample report toggle — logged out, above demo */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActivePanel(p => p === 'sample' ? null : 'sample')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: '1px solid #30363d',
                    borderRadius: 20, padding: '5px 14px',
                    color: '#8b949e', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'border-color 0.2s, color 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#818cf8' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
                >
                  <span style={{ fontSize: 10 }}>{activePanel === 'sample' ? '▼' : '▶'}</span>
                  {activePanel === 'sample' ? 'Hide sample report' : 'View sample report'}
                </button>
              </div>
              {activePanel === 'sample' && <SampleReportBanner />}
              <DemoSection />
              </>
            ) : state === STATE.IDLE && user ? (
              <>
                <div style={{ height: 48 }} />
                <SearchBar onSubmit={handleSubmit} loading={false} credits={credits} />
                {/* Toggle row */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActivePanel(p => p === 'demo' ? null : 'demo')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'none', border: '1px solid #30363d',
                      borderRadius: 20, padding: '5px 14px',
                      color: '#8b949e', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'border-color 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.color = '#38bdf8' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
                  >
                    <span style={{ fontSize: 10 }}>{activePanel === 'demo' ? '▼' : '▶'}</span>
                    {activePanel === 'demo' ? 'Hide demo' : 'See how it works'}
                  </button>
                  <button
                    onClick={() => setActivePanel(p => p === 'examples' ? null : 'examples')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'none', border: '1px solid #30363d',
                      borderRadius: 20, padding: '5px 14px',
                      color: '#8b949e', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'border-color 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#34d399'; e.currentTarget.style.color = '#34d399' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
                  >
                    <span style={{ fontSize: 10 }}>{activePanel === 'examples' ? '▼' : '▶'}</span>
                    {activePanel === 'examples' ? 'Hide examples' : 'See example strategies'}
                  </button>
                  <button
                    onClick={() => setActivePanel(p => p === 'sample' ? null : 'sample')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'none', border: '1px solid #30363d',
                      borderRadius: 20, padding: '5px 14px',
                      color: '#8b949e', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'border-color 0.2s, color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#818cf8' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
                  >
                    <span style={{ fontSize: 10 }}>{activePanel === 'sample' ? '▼' : '▶'}</span>
                    {activePanel === 'sample' ? 'Hide sample report' : 'View sample report'}
                  </button>
                </div>
                {activePanel === 'demo'     && <DemoSection />}
                {activePanel === 'examples' && <ExamplesSection />}
                {activePanel === 'sample'   && <SampleReportBanner />}
              </>
            ) : null}
          </div>
        )}

        {/* Error card */}
        {state === STATE.ERROR && error && (
          <div
            className="fade-in"
            style={{
              marginTop: 24,
              maxWidth: 680,
              width: '100%',
              background: '#0d1117',
              border: `1px solid ${isNoCredits ? '#2d3a2d' : '#3d1a1a'}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div style={{ height: 3, background: isNoCredits ? 'linear-gradient(90deg, #34d399, #38bdf8)' : 'linear-gradient(90deg, #ff4444, #ff8844)' }} />
            <div style={{ padding: '28px 32px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: isNoCredits ? 'rgba(52,211,153,0.12)' : 'rgba(255,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {isNoCredits ? '✦' : '⚠'}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: isNoCredits ? '#34d399' : '#ff6b6b', margin: 0 }}>
                  {error.headline}
                </h3>
              </div>

              <p style={{ fontSize: 14, color: '#ffffff', lineHeight: 1.6, marginBottom: 12 }}>
                {error.detail}
              </p>

              {!isNoCredits && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  borderRadius: 20, padding: '4px 12px', marginBottom: 16,
                }}>
                  <span style={{ fontSize: 11, color: '#34d399' }}>✓</span>
                  <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>No credits were deducted</span>
                </div>
              )}

              {error.suggestion && (
                <div style={{
                  background: 'rgba(0,212,255,0.06)',
                  border: '1px solid rgba(0,212,255,0.18)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 20,
                }}>
                  <span style={{ fontSize: 15, marginTop: 1 }}>💡</span>
                  <p style={{ fontSize: 13, color: '#8ecae6', lineHeight: 1.6, margin: 0 }}>
                    <strong style={{ color: '#00d4ff' }}>Try this: </strong>
                    {error.suggestion}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {isNoCredits && (
                  <button
                    onClick={() => navigate('/buy-credits')}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Buy Credits →
                  </button>
                )}
                <button
                  onClick={handleReset}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 8,
                    border: '1px solid #30363d',
                    background: 'transparent',
                    color: '#e6edf3',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#00d4ff'; e.currentTarget.style.background = 'rgba(0,212,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.background = 'transparent' }}
                >
                  ← Try a different strategy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {state === STATE.RESULTS && summary && (
          <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 80 }}>
            {downloadId && (
              <div>
                <DownloadPanel
                  downloadId={downloadId}
                  onReset={handleReset}
                  onImprove={lastRunParams?.strategy ? () => setShowImprover(v => !v) : undefined}
                />
                {showImprover && lastRunParams?.strategy && (
                  <StrategyImprover
                    strategy={lastRunParams.strategy}
                    summary={summary}
                    onRerun={handleRerun}
                    onClose={() => setShowImprover(false)}
                    getIdToken={getIdToken}
                    credits={credits}
                  />
                )}
              </div>
            )}
            <ResultsSummary summary={summary} />
          </div>
        )}

        {/* Limitations section */}
        <LimitationsSection />

        {/* Disclaimer footer */}
        <div style={{
          marginTop: 60,
          paddingTop: 20,
          borderTop: '1px solid #21262d',
          width: '100%',
          maxWidth: 700,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 11, color: '#484f58', lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: '#6e7681' }}>Disclaimer:</strong> Backtest.ai is for informational and educational purposes only. Past performance of any strategy does not guarantee future results. This tool does not constitute financial advice. Please consult a qualified financial advisor before making any investment decisions.
          </p>
        </div>

      </div>
    </div>
  )
}
