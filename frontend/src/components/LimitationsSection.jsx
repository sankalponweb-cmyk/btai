import { useState } from 'react'

const ITEMS = [
  { label: 'Fundamentals (P/E, EPS, book value)', note: 'Not used in the engine — would need a separate data source.' },
  { label: 'Dividend yields', note: 'Embedded in adjusted prices but not as a separate series. LIQUIDBEES yield is understated (~1% in data vs ~7% actual).' },
  { label: 'Intraday data', note: 'Only daily, weekly, and monthly intervals are supported. Intraday strategies are not available.' },
  { label: 'Sentiment / news data', note: 'Not available from Yahoo Finance.' },
  { label: 'Real-time / live prices', note: 'Historical data only — no streaming or live feed.' },
]

export default function LimitationsSection() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginTop: 60, width: '100%', maxWidth: 700 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, marginBottom: open ? 12 : 0, fontFamily: 'inherit',
        }}
      >
        <p style={{
          fontSize: 11, fontWeight: 700, color: '#c9d1d9',
          letterSpacing: '0.08em', margin: 0,
        }}>
          KNOWN LIMITATIONS
        </p>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M4 6l4 4 4-4" stroke="#8b949e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 8px rgba(0,0,0,0.3)',
        }}>
          {ITEMS.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, padding: '13px 18px',
              borderBottom: i < ITEMS.length - 1 ? '1px solid #30363d' : 'none',
              alignItems: 'flex-start',
            }}>
              <span style={{ color: '#f0883e', fontSize: 13, marginTop: 1, flexShrink: 0 }}>⚠</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9', margin: '0 0 3px' }}>{item.label}</p>
                <p style={{ fontSize: 11, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
