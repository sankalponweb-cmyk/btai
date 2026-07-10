const EXAMPLES = [
  {
    title: 'Nifty 50 Golden Cross',
    type: 'Trend Following · Single Asset',
    tags: ['Moving Average', 'Long Only', 'Daily'],
    description:
      'Buy Nifty 50 when the 50-day moving average crosses above the 200-day moving average (Golden Cross). Sell and move to cash when the 50-day SMA crosses back below the 200-day SMA (Death Cross). Use ₹10 lakh initial capital on daily data over the last 10 years.',
    why: 'Specific ticker (Nifty 50), clear entry signal (50/200 MA cross), clear exit signal (reverse cross), defined capital, defined period.',
  },
  {
    title: 'Top-2 Large-Cap Momentum Rotation',
    type: 'Momentum · Multi-Asset Rotation',
    tags: ['Momentum', 'Monthly Rebalance', 'Equal Weight'],
    description:
      'Universe: Reliance Industries, TCS, Infosys, HDFC Bank, and Wipro. Every month, rank these 5 stocks by their 3-month price return. Buy the top 2 performers in equal weight (50% each). Rebalance monthly, replacing any stock that drops out of the top 2. Use ₹10 lakh initial capital and backtest over the last 5 years on daily data.',
    why: 'Named universe, specific ranking metric (3-month return), clear position sizing (equal weight top-2), explicit rebalance frequency, defined capital and period.',
  },
]

export default function ExamplesSection() {
  return (
    <div style={{ width: '100%', maxWidth: 760, marginTop: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {EXAMPLES.map((ex, i) => (
          <div
            key={i}
            style={{
              background: '#0d1117',
              border: '1px solid #21262d',
              borderRadius: 14,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#30363d'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#21262d'}
          >
            {/* Top accent bar */}
            <div style={{
              height: 2,
              background: i === 0
                ? 'linear-gradient(90deg, #38bdf8, #818cf8)'
                : 'linear-gradient(90deg, #34d399, #38bdf8)',
            }} />

            <div style={{ padding: '18px 22px 20px' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      background: i === 0
                        ? 'linear-gradient(135deg, #38bdf8, #818cf8)'
                        : 'linear-gradient(135deg, #34d399, #38bdf8)',
                      WebkitBackgroundClip: 'text', backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      EXAMPLE {i + 1}
                    </span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', margin: '0 0 3px' }}>
                    {ex.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#484f58', margin: 0 }}>{ex.type}</p>
                </div>
                {/* Tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ex.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 9px',
                      borderRadius: 20, border: '1px solid #30363d',
                      color: '#8b949e', background: '#161b22',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Strategy text */}
              <div style={{
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 12,
              }}>
                <p style={{
                  fontSize: 13, color: '#c9d1d9', lineHeight: 1.65,
                  margin: 0, fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  {ex.description}
                </p>
              </div>

              {/* Why it works note */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>✓</span>
                <p style={{ fontSize: 11, color: '#484f58', margin: 0, lineHeight: 1.55 }}>
                  <span style={{ color: '#8b949e', fontWeight: 600 }}>Why it's specific: </span>
                  {ex.why}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
