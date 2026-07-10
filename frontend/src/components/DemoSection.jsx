import { useState, useEffect } from 'react'

const FULL_TEXT = "Buy Nifty 50 when the 50-day moving average crosses above the 200-day MA. Sell when it crosses back below."

const METRICS = [
  { label: 'TOTAL RETURN', value: '+127.4%' },
  { label: 'CAGR',         value: '+17.2%'  },
  { label: 'SHARPE',       value: '1.43'    },
  { label: 'MAX DRAWDOWN', value: '-18.3%'  },
]

const STEP_LABELS = ['Describe strategy', 'Set parameters', 'Running backtest', 'View results']

// Smooth equity-curve SVG path (500×80 viewBox, trending upward)
const EQUITY_PATH = "M0 72 C40 70,70 62,110 52 C150 42,170 50,200 40 C230 30,250 35,280 24 C310 14,340 18,370 12 C400 6,430 14,460 8 L500 5"

export default function DemoSection() {
  const [phase,          setPhase]          = useState(0)
  const [typed,          setTyped]          = useState('')
  const [charIdx,        setCharIdx]        = useState(0)
  const [runClicked,     setRunClicked]     = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [visibleMetrics, setVisibleMetrics] = useState([])
  const [chartProg,      setChartProg]      = useState(0)

  const doReset = () => {
    setPhase(0); setTyped(''); setCharIdx(0)
    setRunClicked(false); setLoading(false)
    setVisibleMetrics([]); setChartProg(0)
  }

  // Phase 0 — typewriter
  useEffect(() => {
    if (phase !== 0) return
    if (charIdx >= FULL_TEXT.length) {
      const t = setTimeout(() => setPhase(1), 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setTyped(FULL_TEXT.slice(0, charIdx + 1))
      setCharIdx(c => c + 1)
    }, charIdx < 3 ? 150 : 32)
    return () => clearTimeout(t)
  }, [phase, charIdx])

  // Phase 1 — parameters animate in, then advance
  useEffect(() => {
    if (phase !== 1) return
    const t = setTimeout(() => setPhase(2), 1800)
    return () => clearTimeout(t)
  }, [phase])

  // Phase 2 — run button click → loading → results
  useEffect(() => {
    if (phase !== 2) return
    setRunClicked(true)
    const t1 = setTimeout(() => { setRunClicked(false); setLoading(true) }, 350)
    const t2 = setTimeout(() => { setLoading(false); setPhase(3) }, 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [phase])

  // Phase 3 — metrics pop in, chart draws, then loop
  useEffect(() => {
    if (phase !== 3) return
    METRICS.forEach((_, i) => {
      setTimeout(() => setVisibleMetrics(prev => [...prev, i]), i * 220)
    })
    let prog = 0
    const interval = setInterval(() => {
      prog += 1.6
      setChartProg(Math.min(prog, 100))
      if (prog >= 100) clearInterval(interval)
    }, 20)
    const t = setTimeout(doReset, 5500)
    return () => { clearInterval(interval); clearTimeout(t) }
  }, [phase])

  const showParams  = phase >= 1
  const showRunBtn  = phase >= 1
  const showResults = phase === 3

  return (
    <div style={{ width: '100%', maxWidth: 760, marginTop: 32 }}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'center' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(56,189,248,0.15)',
          border: '1px solid rgba(56,189,248,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
        }}>▶</div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', letterSpacing: '0.04em' }}>
          See how it works
        </p>
        {/* Curvy arrow pointing down */}
        <svg width="40" height="48" viewBox="0 0 40 48" fill="none" style={{ marginLeft: 4, marginTop: 6 }}>
          <path
            d="M2 6 C14 4, 36 8, 32 24 C28 38, 18 38, 20 46"
            stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85"
          />
          <path
            d="M13 42 L20 48 L27 42"
            stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"
          />
        </svg>
      </div>

      {/* Browser mockup */}
      <div style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid #30363d',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Chrome bar */}
        <div style={{
          background: '#1c2128',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid #30363d',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#ff5f57','#febc2e','#28c840'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <div style={{
            flex: 1, maxWidth: 260, margin: '0 auto',
            background: '#0d1117', borderRadius: 6,
            padding: '4px 12px', textAlign: 'center',
            fontSize: 12, color: '#8b949e',
          }}>
            backtest.ai
          </div>
          <div style={{ width: 52 }} />
        </div>

        {/* Page content */}
        <div style={{
          background: '#000000',
          minHeight: 300,
          padding: '24px 28px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          {!showResults ? (
            /* ── Search card ── */
            <div style={{
              width: '100%', maxWidth: 560,
              borderRadius: 14, padding: 2,
              background: phase === 2
                ? 'linear-gradient(135deg, #38bdf8, #818cf8, #00ff88)'
                : 'linear-gradient(135deg, #30363d, #30363d)',
              transition: 'background 0.4s ease',
              boxShadow: phase === 2 ? '0 0 30px rgba(56,189,248,0.2)' : 'none',
            }}>
              <div style={{ borderRadius: 12, background: '#ffffff', overflow: 'hidden' }}>
                {/* Textarea area */}
                <div style={{ padding: '16px 18px 10px', minHeight: 68, position: 'relative' }}>
                  <p style={{
                    fontSize: 13, color: '#0d1117', lineHeight: 1.6,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {typed || (
                      <span style={{ color: '#8b949e' }}>
                        Describe your trading strategy in plain English…
                      </span>
                    )}
                    {phase === 0 && <span className="demo-cursor">|</span>}
                  </p>
                </div>

                {/* Params */}
                {showParams && (
                  <div style={{
                    display: 'flex', gap: 8, margin: '0 12px 10px',
                    padding: '8px 10px',
                    background: '#f6f8fa', border: '1px solid #e8eaed', borderRadius: 10,
                    animation: 'demoFadeUp 0.4s ease forwards',
                  }}>
                    {/* Capital */}
                    <div style={{
                      flex: '1 1 120px', background: '#fff',
                      border: '1px solid #d0d7de', borderRadius: 8, padding: '5px 10px',
                      textAlign: 'center',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#000', letterSpacing: '0.06em', marginBottom: 2 }}>
                        INITIAL CAPITAL
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#24292f' }}>₹10L</p>
                    </div>
                    {/* Period */}
                    <div style={{
                      flex: '2 1 200px', background: '#fff',
                      border: '1px solid #d0d7de', borderRadius: 8, padding: '5px 10px',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#000', letterSpacing: '0.06em', marginBottom: 5 }}>
                        BACKTEST PERIOD
                      </p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {['Last 1Y','Last 3Y','Last 5Y','Last 10Y','10Y+'].map(p => (
                          <span key={p} style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                            background: p === 'Last 5Y' ? 'linear-gradient(135deg,#38bdf8,#818cf8)' : 'transparent',
                            border: `1px solid ${p === 'Last 5Y' ? 'transparent' : '#d0d7de'}`,
                            color: p === 'Last 5Y' ? '#fff' : '#57606a',
                          }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Run button */}
                {showRunBtn && (
                  <div style={{ padding: '0 12px 12px' }}>
                    <div style={{
                      padding: '10px 0', borderRadius: 9, textAlign: 'center',
                      fontWeight: 600, fontSize: 14,
                      fontFamily: "'Space Grotesk', sans-serif",
                      background: loading
                        ? '#e8eaed'
                        : 'linear-gradient(135deg, #38bdf8, #818cf8)',
                      color: loading ? '#8b949e' : '#ffffff',
                      transform: runClicked ? 'scale(0.97)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                      boxShadow: !loading ? '0 4px 16px rgba(56,189,248,0.25)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      {loading && (
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%',
                          border: '2px solid #c0c8d1',
                          borderTopColor: '#8b949e',
                          animation: 'spin 0.7s linear infinite',
                        }} />
                      )}
                      {loading ? 'Analysing with AI…' : 'Run Backtest →'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Results ── */
            <div style={{ width: '100%', maxWidth: 560, animation: 'demoFadeUp 0.4s ease forwards' }}>
              {/* Metric cards */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {METRICS.map((m, i) => (
                  <div key={i} style={{
                    flex: '1 1 100px',
                    background: '#0a0a0a', border: '1px solid #21262d', borderRadius: 10,
                    padding: '10px 14px',
                    opacity: visibleMetrics.includes(i) ? 1 : 0,
                    transform: visibleMetrics.includes(i) ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'all 0.35s ease',
                  }}>
                    <p style={{ fontSize: 9, color: '#8b949e', marginBottom: 4, letterSpacing: '0.05em' }}>
                      {m.label}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Mini equity chart */}
              <div style={{
                background: '#0a0a0a', border: '1px solid #21262d', borderRadius: 10,
                padding: '10px 14px',
                opacity: visibleMetrics.length >= 2 ? 1 : 0,
                transition: 'opacity 0.4s ease 0.3s',
              }}>
                <p style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.05em', marginBottom: 6 }}>
                  EQUITY CURVE
                </p>
                <svg viewBox="0 0 500 80" style={{ width: '100%', height: 56 }} preserveAspectRatio="none">
                  {/* Benchmark faint line */}
                  <path
                    d="M0 72 C100 68,200 60,300 54 C400 48,450 44,500 40"
                    fill="none" stroke="#C00000" strokeWidth="1.2" opacity="0.5"
                    pathLength="1"
                    strokeDasharray={`${chartProg / 100} 1`}
                  />
                  {/* Equity line */}
                  <path
                    d={EQUITY_PATH}
                    fill="none" stroke="#2E75B6" strokeWidth="2"
                    pathLength="1"
                    strokeDasharray={`${chartProg / 100} 1`}
                  />
                  {/* Area fill */}
                  <path
                    d={`${EQUITY_PATH} L500 80 L0 80 Z`}
                    fill="url(#miniGrad)" opacity="0.25"
                    pathLength="1"
                  />
                  <defs>
                    <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2E75B6" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#2E75B6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Download badge */}
              <div style={{
                marginTop: 10, display: 'flex', justifyContent: 'flex-end',
                opacity: visibleMetrics.length === 4 ? 1 : 0,
                transition: 'opacity 0.4s ease 0.8s',
              }}>
                <div style={{
                  padding: '7px 16px', borderRadius: 8,
                  background: 'rgba(0,255,136,0.08)',
                  border: '1px solid rgba(0,255,136,0.25)',
                  fontSize: 12, fontWeight: 600, color: '#00ff88',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>↓</span> Download Excel Report
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div style={{
          background: '#0d1117',
          borderTop: '1px solid #21262d',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}>
          {STEP_LABELS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                height: 6,
                width: phase === i ? 28 : 8,
                borderRadius: 3,
                background: phase === i ? '#38bdf8' : phase > i ? '#818cf8' : '#30363d',
                transition: 'all 0.3s ease',
              }} />
              {phase === i && (
                <span style={{ fontSize: 11, color: '#8b949e', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
