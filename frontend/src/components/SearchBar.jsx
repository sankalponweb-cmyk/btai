import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const GUIDE_ELEMENTS = [
  { icon: '🌐', title: 'Universe', desc: 'Which stocks, index or ETF will the strategy trade on?', example: 'e.g. All stocks in Nifty 50, Nifty Bank, or NIFTYBEES ETF' },
  { icon: '📈', title: 'Entry Trigger / Signal', desc: 'What condition causes the strategy to go long or short?', example: 'e.g. Buy when 50-day SMA crosses above 200-day SMA' },
  { icon: '📉', title: 'Exit Trigger / Signal', desc: 'What condition causes the strategy to exit?', example: 'e.g. Sell when price crosses below 50-day SMA, or RSI > 70' },
  { icon: '🔁', title: 'Rebalancing', desc: 'How often should the strategy evaluate its signals?', example: 'e.g. Check signals daily, rebalance every week or month' },
  { icon: '📅', title: 'Data Interval', desc: 'Should the strategy use daily, weekly, or monthly closes?', example: 'e.g. Use daily closing prices, or weekly bars' },
]

const UNSUPPORTED_PATTERNS = [
  {
    regex: /\b(p\/e|pe ratio|price.to.earnings|price\/earnings|eps|earnings per share|book value|revenue|net profit|quarterly (results|earnings)|balance sheet|fundamental|intrinsic value|dcf|discounted cash flow)\b/i,
    label: 'Fundamental data (P/E, EPS, book value) is not available',
    note: 'The engine uses price/volume data only — fundamentals are not supported.',
  },
  {
    regex: /\b(dividend yield|dividend %|yield)\b/i,
    label: 'Dividend yield as a separate signal is not supported',
    note: 'Dividends are embedded in adjusted prices but not available as a standalone series.',
  },
  {
    regex: /\b(intraday|(\d+)\s*[-–]?\s*(min(ute)?s?|hour|hr)|hourly|scalp(ing)?|tick data|hft|high.frequency)\b/i,
    label: 'Intraday intervals are not supported',
    note: 'Only daily, weekly, and monthly bars are available.',
  },
  {
    regex: /\b(sentiment|news (flow|data|signal)|social media|twitter|reddit|fear.and.greed|fear &amp; greed|vix signal|put.call ratio)\b/i,
    label: 'Sentiment and news data is not available',
    note: 'The backtester uses Yahoo Finance price/volume data only.',
  },
  {
    regex: /\b(live (price|data)|real.?time|streaming|tick by tick|last traded price|ltp)\b/i,
    label: 'Real-time / live prices are not supported',
    note: 'Only historical end-of-day data is available.',
  },
]

const PERIODS = [
  { label: 'Last 1Y',  years: 1  },
  { label: 'Last 3Y',  years: 3  },
  { label: 'Last 5Y',  years: 5  },
  { label: 'Last 10Y', years: 10 },
  { label: '10Y+',     years: 15 },
]

export default function SearchBar({ onSubmit, loading, credits }) {
  const [value,   setValue]   = useState('')
  const [focused, setFocused] = useState(false)
  const [capital, setCapital] = useState('10')   // in Lakhs
  const [period,  setPeriod]  = useState('Last 5Y')
  const textareaRef = useRef(null)
  const navigate    = useNavigate()

  const noCredits = typeof credits === 'number' && credits === 0
  const [showGuide, setShowGuide] = useState(false)

  const warnings = useMemo(() => {
    if (!value.trim()) return []
    return UNSUPPORTED_PATTERNS.filter(p => p.regex.test(value))
  }, [value])

  const handleSubmit = () => {
    if (!value.trim() || loading || noCredits) return
    const sel = PERIODS.find(p => p.label === period) || PERIODS[2]
    const d = new Date()
    d.setFullYear(d.getFullYear() - sel.years)
    const lakhs = Math.max(0.01, parseFloat(capital) || 10)
    onSubmit({
      strategy:       value.trim(),
      initialCapital: lakhs * 1_00_000,
      startDate:      d.toISOString().slice(0, 10),
    })
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  const canSubmit = value.trim() && !loading && !noCredits

  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      {/* Info button row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, position: 'relative' }}>
        <div
          onMouseEnter={() => setShowGuide(true)}
          onMouseLeave={() => setShowGuide(false)}
          style={{ position: 'relative' }}
        >
          <button style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '4px 12px',
            color: '#8b949e', fontSize: 12, cursor: 'default',
            fontFamily: 'inherit', fontWeight: 500,
          }}>
            <span style={{ fontSize: 13 }}>ℹ</span> How to describe a strategy
          </button>

          {showGuide && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              width: 420, zIndex: 100,
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #21262d',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', margin: 0, letterSpacing: '0.06em' }}>
                  KEY ELEMENTS OF A STRATEGY
                </p>
                <p style={{
                  fontSize: 10, margin: 0, fontWeight: 700, letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>More specific = better results</p>
              </div>
              {GUIDE_ELEMENTS.map((el, i) => (
                <div key={i} style={{
                  padding: '10px 16px',
                  borderBottom: i < GUIDE_ELEMENTS.length - 1 ? '1px solid #21262d' : 'none',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{el.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3', margin: '0 0 2px' }}>{el.title}</p>
                    <p style={{ fontSize: 11, color: '#8b949e', margin: '0 0 2px', lineHeight: 1.5 }}>{el.desc}</p>
                    <p style={{ fontSize: 10, color: '#484f58', margin: 0, fontStyle: 'italic' }}>{el.example}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Gradient-border wrapper */}
      <div style={{
        borderRadius: 18,
        padding: 2,
        background: focused
          ? 'linear-gradient(135deg, #38bdf8, #818cf8, #00ff88)'
          : 'linear-gradient(135deg, #30363d, #30363d)',
        transition: 'background 0.3s ease',
        boxShadow: focused ? '0 0 40px rgba(56,189,248,0.2)' : 'none',
      }}>
        <div style={{ borderRadius: 16, background: '#ffffff', overflow: 'hidden' }}>

          {/* Strategy textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder={"Describe your trading strategy in plain English…\ne.g. Buy Nifty when 50-day MA crosses above 200-day MA, sell when it crosses below"}
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              padding: '18px 24px 10px',
              color: '#0d1117',
              fontSize: 16,
              fontFamily: "'Space Grotesk', sans-serif",
              lineHeight: 1.6,
            }}
          />

          {/* Parameter boxes row */}
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '8px 14px',
            margin: '6px 14px',
            background: '#f6f8fa',
            border: '1px solid #e8eaed',
            borderRadius: 12,
            flexWrap: 'wrap',
          }}>
            {/* Initial Capital */}
            <div style={{
              flex: '1 1 170px',
              background: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: 10,
              padding: '6px 12px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#000000',
                  letterSpacing: '0.07em',
                  marginBottom: 2,
                }}>
                  INITIAL CAPITAL
                </p>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#24292f', fontSize: 14, fontWeight: 600 }}>₹</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={capital}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      setCapital(v)
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#24292f',
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "'Space Grotesk', sans-serif",
                      width: `${Math.max(1, capital.length) * 10}px`,
                      textAlign: 'center',
                      padding: 0,
                    }}
                  />
                  <span style={{ color: '#24292f', fontSize: 14, fontWeight: 600 }}>L</span>
                </div>
              </div>
            </div>

            {/* Backtest Period */}
            <div style={{
              flex: '2 1 320px',
              background: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: 10,
              padding: '6px 12px',
            }}>
              <p style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#000000',
                letterSpacing: '0.07em',
                marginBottom: 4,
              }}>
                BACKTEST PERIOD
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PERIODS.map(opt => {
                  const active = period === opt.label
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setPeriod(opt.label)}
                      style={{
                        padding: '3px 11px',
                        borderRadius: 20,
                        border: `1px solid ${active ? 'transparent' : '#d0d7de'}`,
                        background: active
                          ? 'linear-gradient(135deg, #38bdf8, #818cf8)'
                          : 'transparent',
                        color: active ? '#ffffff' : '#57606a',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: "'Space Grotesk', sans-serif",
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Action row */}
          <div style={{ padding: '10px 14px 14px' }}>
            {noCredits ? (
              <p style={{ fontSize: 13, color: '#8b949e', textAlign: 'center', padding: '10px 0', margin: 0 }}>
                You've used your free beta credits — thank you for testing!
              </p>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 10,
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  background: canSubmit
                    ? 'linear-gradient(135deg, #38bdf8, #818cf8)'
                    : '#e8eaed',
                  color: canSubmit ? '#ffffff' : '#8b949e',
                  transition: 'all 0.2s ease',
                  boxShadow: canSubmit ? '0 4px 20px rgba(56,189,248,0.3)' : 'none',
                }}
              >
                {loading ? 'Running…' : 'Run Backtest →'}
              </button>
            )}
          </div>

        </div>
      </div>
      {warnings.length > 0 && (
        <div style={{
          marginTop: 10,
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', margin: 0, letterSpacing: '0.06em' }}>
            ⚠ UNSUPPORTED DATA DETECTED
          </p>
          {warnings.map((w, i) => (
            <div key={i}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', margin: '0 0 2px' }}>{w.label}</p>
              <p style={{ fontSize: 11, color: '#8b949e', margin: 0, lineHeight: 1.5 }}>{w.note}</p>
            </div>
          ))}
          <p style={{ fontSize: 11, color: '#6e7681', margin: 0, lineHeight: 1.5 }}>
            The backtest will run using price/volume data only. Results may not reflect the intended strategy.
          </p>
        </div>
      )}
    </div>
  )
}
