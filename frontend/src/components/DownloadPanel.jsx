import { useState } from 'react'

export default function DownloadPanel({ downloadId, onReset, onImprove }) {
  const [hover, setHover] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/download/${downloadId}/excel`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'backtest_report.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fade-in"
      style={{
        width: '100%',
        maxWidth: 900,
        background: '#0a0a0a',
        border: '1px solid #21262d',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <div>
        <p style={{ fontWeight: 600, fontSize: 16, color: '#e6edf3', marginBottom: 4 }}>
          Your report is ready
        </p>
        <p style={{ fontSize: 13, color: '#8b949e' }}>
          Full backtest analysis with trade log, metrics, and equity curve.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 28px',
            borderRadius: 12,
            border: `1px solid ${hover ? '#00ff88' : '#30363d'}`,
            background: hover ? 'rgba(0,255,136,0.08)' : '#0a0a0a',
            color: hover ? '#00ff88' : '#c9d1d9',
            cursor: downloading ? 'wait' : 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            transition: 'all 0.2s ease',
            boxShadow: hover ? '0 0 20px rgba(0,255,136,0.13)' : 'none',
            opacity: downloading ? 0.7 : 1,
          }}
        >
          {/* Microsoft Excel logo */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="22" height="22" rx="4" fill="#1D6F42"/>
            <path d="M13 4H18.5C18.78 4 19 4.22 19 4.5V17.5C19 17.78 18.78 18 18.5 18H13V4Z" fill="#21A366"/>
            <path d="M13 4H18.5C18.78 4 19 4.22 19 4.5V17.5C19 17.78 18.78 18 18.5 18H13V4Z" fill="url(#xlGrad)"/>
            <rect x="13" y="4" width="6" height="14" rx="0" fill="#21A366"/>
            <rect x="13" y="9.5" width="6" height="0.8" fill="#107C41" opacity="0.5"/>
            <rect x="13" y="11.7" width="6" height="0.8" fill="#107C41" opacity="0.5"/>
            <rect x="13" y="13.9" width="6" height="0.8" fill="#107C41" opacity="0.5"/>
            <rect x="14.5" y="6" width="3" height="0.8" fill="white" opacity="0.7"/>
            <path d="M3 5.5H13V16.5H3C2.72 16.5 2.5 16.28 2.5 16V6C2.5 5.72 2.72 5.5 3 5.5Z" fill="#107C41"/>
            <text x="7.5" y="14" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="bold" fontFamily="Arial, sans-serif">X</text>
          </svg>
          {downloading ? 'Downloading…' : 'Download Excel'}
        </button>

        {onImprove && (
          <button
            onClick={onImprove}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '14px 22px',
              borderRadius: 12,
              border: '1px solid rgba(129,140,248,0.35)',
              background: 'rgba(129,140,248,0.07)',
              color: '#818cf8',
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.14)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.07)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.35)' }}
          >
            <span style={{ fontSize: 14 }}>✦</span>
            Improve Strategy
          </button>
        )}

        <button
          onClick={onReset}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '14px 22px',
            borderRadius: 12,
            border: '1px solid rgba(248,113,113,0.35)',
            background: 'rgba(248,113,113,0.07)',
            color: '#f87171',
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.14)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.07)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.35)' }}
        >
          <span style={{ fontSize: 14 }}>↩</span>
          Try Another Strategy
        </button>
      </div>
    </div>
  )
}
