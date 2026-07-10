import { useState, useEffect } from 'react'

export default function StrategyImprover({ strategy, summary, onRerun, onClose, getIdToken, credits }) {
  const [loading,     setLoading]     = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [selected,    setSelected]    = useState(null)
  const [custom,      setCustom]      = useState('')
  const [error,       setError]       = useState(null)

  const noCredits = typeof credits === 'number' && credits === 0

  const fetchSuggestions = async () => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    setSelected(null)
    setCustom('')
    try {
      const token = await getIdToken()
      const res = await fetch('/api/suggest-improvements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ strategy, summary }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {
      setError('Could not load suggestions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch when panel mounts
  useEffect(() => { fetchSuggestions() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSuggestion = (i) => {
    setSelected(i)
    setCustom(suggestions[i].instruction || suggestions[i].revised_strategy || '')
  }

  const handleRerun = () => {
    const addition = custom.trim()
    if (!addition || noCredits) return
    // Append the improvement instruction to the original strategy
    onRerun(`${strategy}\n\nImprovement instructions: ${addition}`)
  }

  const canRerun = custom.trim().length > 0 && !noCredits

  return (
    <div style={{
      width: '100%',
      background: '#0d1117',
      border: '1px solid #30363d',
      borderTop: '2px solid #818cf8',
      borderRadius: '0 0 16px 16px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid #21262d',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 13,
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>✦</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', margin: 0 }}>
            Improve Strategy with AI
          </p>
          <span style={{
            fontSize: 10, color: '#484f58',
            background: '#161b22', border: '1px solid #21262d',
            borderRadius: 20, padding: '2px 10px',
          }}>
            Suggestions are free · Retest costs 1 credit
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#484f58', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
          onMouseEnter={e => e.currentTarget.style.color = '#8b949e'}
          onMouseLeave={e => e.currentTarget.style.color = '#484f58'}
        >×</button>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8b949e', fontSize: 13, padding: '8px 0' }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid #30363d', borderTopColor: '#818cf8',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
            Analysing your results and generating recommendations…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{error}</p>
            <button onClick={fetchSuggestions} style={{ fontSize: 12, color: '#8b949e', background: 'none', border: '1px solid #30363d', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Retry
            </button>
          </div>
        )}

        {/* Suggestion chips */}
        {!loading && suggestions.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6e7681', margin: '0 0 10px', letterSpacing: '0.06em' }}>
              AI RECOMMENDATIONS — click to apply
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.map((s, i) => {
                const isActive = selected === i
                return (
                  <div
                    key={i}
                    onClick={() => handleSelectSuggestion(i)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: `1px solid ${isActive ? '#818cf8' : '#d0d7de'}`,
                      background: isActive ? 'rgba(129,140,248,0.06)' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#818cf8' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = '#d0d7de' }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        border: `2px solid ${isActive ? '#818cf8' : '#d0d7de'}`,
                        background: isActive ? '#818cf8' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#fff', fontWeight: 700,
                      }}>
                        {isActive ? '✓' : i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#818cf8' : '#24292f', margin: '0 0 3px' }}>
                          {s.title}
                        </p>
                        <p style={{ fontSize: 11, color: '#57606a', margin: '0 0 6px', lineHeight: 1.5 }}>{s.issue}</p>
                        <p style={{ fontSize: 11, color: isActive ? '#57606a' : '#6e7781', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                          + "{s.instruction || s.revised_strategy}"
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Text input */}
        {!loading && (suggestions.length > 0 || error) && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6e7681', margin: '0 0 8px', letterSpacing: '0.06em' }}>
              {selected !== null ? 'REFINEMENT INSTRUCTION — edit if needed' : 'OR WRITE YOUR OWN IMPROVEMENT'}
            </p>
            <textarea
              value={custom}
              onChange={e => { setCustom(e.target.value); setSelected(null) }}
              placeholder="e.g. Add a 5% trailing stop-loss. Only trade on Fridays. Limit to top 5 stocks by momentum."
              rows={3}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #d0d7de',
                borderRadius: 10,
                color: '#24292f',
                fontSize: 13,
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: 1.6,
                padding: '10px 14px',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#818cf8' }}
              onBlur={e => { e.target.style.borderColor = '#d0d7de' }}
            />
            <p style={{ fontSize: 10, color: '#484f58', margin: '5px 0 0', lineHeight: 1.5 }}>
              This will be appended to your original strategy and sent to Claude for retesting.
            </p>
          </div>
        )}

        {/* Actions */}
        {!loading && (suggestions.length > 0 || error) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleRerun}
              disabled={!canRerun}
              style={{
                padding: '11px 22px',
                borderRadius: 10,
                border: 'none',
                background: canRerun ? 'linear-gradient(135deg, #38bdf8, #818cf8)' : '#21262d',
                color: canRerun ? '#fff' : '#484f58',
                fontSize: 13,
                fontWeight: 600,
                cursor: canRerun ? 'pointer' : 'not-allowed',
                fontFamily: "'Space Grotesk', sans-serif",
                boxShadow: canRerun ? '0 4px 16px rgba(129,140,248,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              Run Revised Backtest →
            </button>
            {canRerun && <p style={{ fontSize: 11, color: '#ffffff', margin: 0 }}>Uses 1 credit</p>}
            {noCredits && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>No credits remaining</p>}
            <button
              onClick={fetchSuggestions}
              style={{
                marginLeft: 'auto', padding: '9px 14px', borderRadius: 8,
                border: '1px solid #21262d', background: 'transparent',
                color: '#6e7681', fontSize: 11, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#21262d'; e.currentTarget.style.color = '#6e7681' }}
            >
              ↻ New suggestions
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
