import {
  ComposedChart, Line, Area,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// ── Metric card ──────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub }) => (
  <div
    style={{
      background: '#0a0a0a',
      border: '1px solid #21262d',
      borderRadius: 14,
      padding: '20px 24px',
      flex: '1 1 160px',
      minWidth: 150,
      transition: 'border-color 0.2s',
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#30363d'}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#21262d'}
  >
    <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 6, letterSpacing: '0.05em' }}>
      {label.toUpperCase()}
    </p>
    <p style={{ fontSize: 26, fontWeight: 700, color: '#e6edf3', lineHeight: 1.1 }}>
      {value}
    </p>
    {sub && (
      <p style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>{sub}</p>
    )}
  </div>
)

// ── Chart tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const byKey = Object.fromEntries(payload.map(p => [p.dataKey, p]))
  const fmt = (v) => v >= 1e6
    ? `₹${(v / 1e5).toFixed(1)}L`
    : `₹${(v / 1000).toFixed(1)}K`

  return (
    <div style={{
      background: '#111111', border: '1px solid #30363d', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, color: '#e6edf3', lineHeight: 1.8,
    }}>
      <p style={{ color: '#8b949e', marginBottom: 4 }}>{label}</p>
      {byKey.portfolio_value && (
        <p><span style={{ color: '#2E75B6' }}>■</span> Equity: {fmt(byKey.portfolio_value.value)}</p>
      )}
      {byKey.benchmark_value && (
        <p><span style={{ color: '#C00000' }}>■</span> Benchmark: {fmt(byKey.benchmark_value.value)}</p>
      )}
      {byKey.drawdown !== undefined && (
        <p><span style={{ color: '#70AD47' }}>■</span> Drawdown: {(byKey.drawdown.value * 100).toFixed(2)}%</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResultsSummary({ summary }) {
  const m = summary.metrics

  // Compute running-max drawdown from portfolio_value (matches Excel formula)
  let runningMax = 0
  const chartData = (summary.equity_curve || []).map(e => {
    runningMax = Math.max(runningMax, e.portfolio_value)
    return {
      date: e.date.slice(0, 7),          // "YYYY-MM" for x-axis
      portfolio_value: e.portfolio_value,
      benchmark_value: e.benchmark_value ?? null,
      drawdown: e.portfolio_value / runningMax - 1,
    }
  })

  const hasBenchmark = chartData.some(d => d.benchmark_value != null)
  const minDrawdown  = Math.min(...chartData.map(d => d.drawdown), -0.001)

  const tickFmt = (v) => v >= 1e6
    ? `₹${(v / 1e5).toFixed(0)}L`
    : `₹${(v / 1000).toFixed(0)}K`

  const legendPayload = [
    { value: 'Equity',    type: 'line', color: '#2E75B6' },
    ...(hasBenchmark ? [{ value: 'Benchmark', type: 'line', color: '#C00000' }] : []),
    { value: 'Drawdown',  type: 'square', color: '#70AD47' },
  ]

  return (
    <div
      className="fade-in"
      style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* Strategy header */}
      <div style={{ borderBottom: '1px solid #21262d', paddingBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3' }}>
          {summary.strategy_name}
        </h2>
        <p style={{ fontSize: 14, color: '#8b949e', marginTop: 4, lineHeight: 1.6 }}>
          {summary.description}
        </p>
      </div>

      {/* Period + capital */}
      {m.start_date && (
        <p style={{ fontSize: 13, color: '#8b949e' }}>
          {m.start_date} → {m.end_date}&nbsp;·&nbsp;
          ₹{(m.starting_capital / 1e5).toFixed(0)}L → ₹{(m.ending_value / 1e5).toFixed(2)}L
        </p>
      )}

      {/* ── Row 1: core performance ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard
          label="Total Return"
          value={`${m.total_return_pct >= 0 ? '+' : ''}${m.total_return_pct?.toFixed(1)}%`}
          sub="vs initial capital"
        />
        <MetricCard
          label="CAGR"
          value={`${m.cagr_pct >= 0 ? '+' : ''}${m.cagr_pct?.toFixed(1)}%`}
          sub="Annualised return"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={m.sharpe_ratio?.toFixed(2)}
          sub={m.sharpe_ratio >= 1 ? 'Good risk-adjusted' : 'Below 1 (weak)'}
        />
        <MetricCard
          label="Sortino Ratio"
          value={m.sortino_ratio?.toFixed(2)}
          sub="Downside-adjusted"
        />
        <MetricCard
          label="Max Drawdown"
          value={`${m.max_drawdown_pct?.toFixed(1)}%`}
          sub="Peak-to-trough loss"
        />
      </div>

      {/* ── Benchmark comparison ───────────────────────────────────────────── */}
      {(m.benchmark_total_return_pct != null || m.benchmark_cagr_pct != null) && (
        <div>
          <p style={{ fontSize: 11, color: '#8b949e', letterSpacing: '0.08em', marginBottom: 8 }}>
            VS BENCHMARK{summary.benchmark_ticker ? ` (${summary.benchmark_ticker})` : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {m.benchmark_total_return_pct != null && (
              <MetricCard
                label="Benchmark Return"
                value={`${m.benchmark_total_return_pct >= 0 ? '+' : ''}${m.benchmark_total_return_pct?.toFixed(1)}%`}
                sub={`Strategy: ${m.total_return_pct >= 0 ? '+' : ''}${m.total_return_pct?.toFixed(1)}%`}
              />
            )}
            {m.benchmark_cagr_pct != null && (
              <MetricCard
                label="Benchmark CAGR"
                value={`${m.benchmark_cagr_pct >= 0 ? '+' : ''}${m.benchmark_cagr_pct?.toFixed(1)}%`}
                sub={`Strategy: ${m.cagr_pct >= 0 ? '+' : ''}${m.cagr_pct?.toFixed(1)}%`}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Row 2: trade stats ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard
          label="Win Rate"
          value={`${m.win_rate_pct?.toFixed(0)}%`}
          sub={`${m.profitable_trades} / ${m.total_trades} trades`}
        />
        <MetricCard
          label="Calmar Ratio"
          value={m.calmar_ratio?.toFixed(2)}
          sub="CAGR / Max DD"
        />
        <MetricCard
          label="Volatility"
          value={`${m.ann_volatility_pct?.toFixed(1)}%`}
          sub="Annualised"
        />
        <MetricCard
          label="Best Day"
          value={`${m.best_day_pct >= 0 ? '+' : ''}${m.best_day_pct?.toFixed(2)}%`}
          sub="Single-bar best"
        />
        <MetricCard
          label="Worst Day"
          value={`${m.worst_day_pct?.toFixed(2)}%`}
          sub="Single-bar worst"
        />
      </div>

      {/* ── Equity curve & drawdown (matches Excel chart) ─────────────────── */}
      {chartData.length > 0 && (
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #21262d',
          borderRadius: 14,
          padding: '20px 24px',
        }}>
          <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 4, letterSpacing: '0.05em' }}>
            EQUITY CURVE & DRAWDOWN
          </p>
          <p style={{ fontSize: 11, color: '#444d56', marginBottom: 16 }}>
            Left axis: portfolio value (₹) &nbsp;·&nbsp; Right axis: drawdown (%)
          </p>

          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 56, left: 10, bottom: 4 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#70AD47" stopOpacity={0.75} />
                  <stop offset="100%" stopColor="#E2EFDA" stopOpacity={0.15} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                tick={{ fill: '#8b949e', fontSize: 11 }}
                axisLine={{ stroke: '#21262d' }}
                tickLine={false}
                interval={Math.floor(chartData.length / 8)}
              />

              {/* Left Y-axis: equity / benchmark in ₹ */}
              <YAxis
                yAxisId="left"
                tickFormatter={tickFmt}
                tick={{ fill: '#8b949e', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={58}
                label={{ value: 'Equity (₹)', angle: -90, position: 'insideLeft', offset: -2, fill: '#555d65', fontSize: 11 }}
              />

              {/* Right Y-axis: drawdown % — 0 at top, negative values downward */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[minDrawdown * 1.15, 0]}
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                tick={{ fill: '#8b949e', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={46}
                label={{ value: 'Drawdown', angle: 90, position: 'insideRight', offset: 10, fill: '#555d65', fontSize: 11 }}
              />

              <Tooltip content={<ChartTooltip />} />

              {/* Drawdown area — drawn first so lines sit on top */}
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="drawdown"
                fill="url(#ddGrad)"
                stroke="#70AD47"
                strokeWidth={1}
                baseValue={0}
                dot={false}
                activeDot={false}
                name="Drawdown"
                legendType="none"
              />

              {/* Equity line — blue, 2 px */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="portfolio_value"
                stroke="#2E75B6"
                strokeWidth={2}
                dot={false}
                name="Equity"
              />

              {/* Benchmark line — dark red, 1.5 px */}
              {hasBenchmark && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="benchmark_value"
                  stroke="#C00000"
                  strokeWidth={1.5}
                  dot={false}
                  name="Benchmark"
                  connectNulls
                />
              )}

              <Legend
                verticalAlign="bottom"
                iconSize={12}
                payload={legendPayload}
                formatter={(v) => (
                  <span style={{ color: '#8b949e', fontSize: 12 }}>{v}</span>
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Strategy rules ────────────────────────────────────────────────── */}
      {summary.rules?.length > 0 && (
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #21262d',
          borderRadius: 14,
          padding: '20px 24px',
        }}>
          <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 12, letterSpacing: '0.05em' }}>
            PARSED STRATEGY RULES
          </p>
          <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.rules.map((rule, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  minWidth: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00d4ff, #00ff88)',
                  color: '#0a0e1a', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: '#c9d1d9', lineHeight: 1.5 }}>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Data quality notices (bottom) ─────────────────────────────────── */}
      {summary.data_anomalies?.length > 0 && (
        <div style={{
          background: 'rgba(255,170,0,0.06)',
          border: '1px solid rgba(255,170,0,0.25)',
          borderRadius: 10,
          padding: '12px 16px',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#ffaa00', marginBottom: 6, letterSpacing: '0.05em' }}>
            ⚡ DATA QUALITY — AUTO-CORRECTED
          </p>
          {summary.data_anomalies.map((msg, i) => (
            <p key={i} style={{ fontSize: 12, color: '#c9a44a', lineHeight: 1.6, margin: '2px 0' }}>• {msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
