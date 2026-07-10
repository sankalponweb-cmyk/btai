const ELEMENTS = [
  {
    icon: '🌐',
    title: 'Universe',
    desc: 'Which stocks or index will the strategy trade on?',
    example: 'e.g. All stocks in Nifty 50, Nifty Bank, or a specific ETF like NIFTYBEES',
  },
  {
    icon: '📈',
    title: 'Entry Trigger / Signal',
    desc: 'What condition causes the strategy to go long or short?',
    example: 'e.g. Buy when 50-day SMA crosses above 200-day SMA, or RSI drops below 30',
  },
  {
    icon: '📉',
    title: 'Exit Trigger / Signal',
    desc: 'What condition causes the strategy to exit the position?',
    example: 'e.g. Sell when price crosses below 50-day SMA, or RSI rises above 70',
  },
  {
    icon: '🔁',
    title: 'Rebalancing',
    desc: 'How often should the strategy evaluate its signals?',
    example: 'e.g. Check signals daily, rebalance every week or month',
  },
  {
    icon: '📅',
    title: 'Data Interval',
    desc: 'Should the strategy use daily, weekly, or monthly price closes?',
    example: 'e.g. Use daily closing prices, or weekly bars for a swing strategy',
  },
]

export default function StrategyGuide() {
  return (
    <div style={{ width: '100%', maxWidth: 760, marginTop: 24 }}>
      <div style={{
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #21262d',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13 }}>💡</span>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#8b949e', margin: 0, letterSpacing: '0.06em' }}>
            KEY ELEMENTS OF A GOOD STRATEGY DESCRIPTION
          </p>
          <span style={{ fontSize: 11, color: '#484f58', marginLeft: 'auto' }}>
            The more specific, the better the results
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {ELEMENTS.map((el, i) => (
            <div key={i} style={{
              padding: '14px 20px',
              borderRight: i % 2 === 0 ? '1px solid #21262d' : 'none',
              borderBottom: i < ELEMENTS.length - 2 ? '1px solid #21262d' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{el.icon}</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3', margin: 0 }}>{el.title}</p>
              </div>
              <p style={{ fontSize: 11, color: '#8b949e', margin: '0 0 4px', lineHeight: 1.5 }}>{el.desc}</p>
              <p style={{ fontSize: 10, color: '#484f58', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>{el.example}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
