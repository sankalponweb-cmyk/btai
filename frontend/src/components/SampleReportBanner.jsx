import { useState } from 'react'

const SHEETS = [
  { icon: '📊', label: 'Strategy Performance', desc: 'CAGR, Sharpe, max drawdown & more' },
  { icon: '📋', label: 'Trade Log',            desc: 'Every entry/exit with P&L' },
  { icon: '📈', label: 'Equity & Drawdown',    desc: 'Chart vs benchmark' },
  { icon: '🔢', label: 'Trade Statistics',     desc: 'Win rate, profit factor, payoff ratio' },
]

export default function SampleReportBanner() {
  const [downloading, setDownloading] = useState(false)
  const [hover,       setHover]       = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res  = await fetch('/api/sample-report')
      if (!res.ok) throw new Error('unavailable')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'backtest_ai_sample_report.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Sample report is temporarily unavailable. Please try again shortly.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      style={{
        width: '100%', maxWidth: 760, marginTop: 32,
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Top accent */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #38bdf8, #818cf8, #00ff88)' }} />

      <div style={{ padding: '22px 26px 24px' }}>
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16, marginBottom: 20,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                SAMPLE REPORT
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', margin: '0 0 3px' }}>
              Nifty 50 — Golden Cross Strategy
            </p>
            <p style={{ fontSize: 12, color: '#484f58', margin: 0 }}>
              50/200 MA crossover · 10-year backtest · See what you get
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '11px 22px', borderRadius: 10, cursor: downloading ? 'wait' : 'pointer',
              border: `1px solid ${hover ? '#00ff88' : '#30363d'}`,
              background: hover ? 'rgba(0,255,136,0.08)' : 'transparent',
              color: hover ? '#00ff88' : '#c9d1d9',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14,
              transition: 'all 0.2s', opacity: downloading ? 0.7 : 1,
              boxShadow: hover ? '0 0 16px rgba(0,255,136,0.12)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Excel icon */}
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="22" height="22" rx="4" fill="#1D6F42"/>
              <rect x="13" y="4" width="6" height="14" rx="0" fill="#21A366"/>
              <rect x="13" y="9.5" width="6" height="0.8" fill="#107C41" opacity="0.5"/>
              <rect x="13" y="11.7" width="6" height="0.8" fill="#107C41" opacity="0.5"/>
              <rect x="13" y="13.9" width="6" height="0.8" fill="#107C41" opacity="0.5"/>
              <path d="M3 5.5H13V16.5H3C2.72 16.5 2.5 16.28 2.5 16V6C2.5 5.72 2.72 5.5 3 5.5Z" fill="#107C41"/>
              <text x="7.5" y="14" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="Arial, sans-serif">X</text>
            </svg>
            {downloading ? 'Generating…' : 'Download Sample'}
          </button>
        </div>

        {/* Sheet previews */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {SHEETS.map(s => (
            <div key={s.label} style={{
              background: '#161b22', border: '1px solid #21262d',
              borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#c9d1d9', margin: '0 0 3px' }}>{s.label}</p>
              <p style={{ fontSize: 11, color: '#484f58', margin: 0, lineHeight: 1.4 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
