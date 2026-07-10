import { useState, useEffect } from 'react'

const STEPS = [
  { label: 'Parsing strategy rules…', duration: 2000 },
  { label: 'Loading historical data…', duration: 2500 },
  { label: 'Simulating trades…', duration: 4000 },
  { label: 'Calculating performance metrics…', duration: 3000 },
  { label: 'Generating reports…', duration: 2000 },
]

export default function LoadingScreen() {
  const [stepIdx, setStepIdx] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    let cumulative = 0
    const timers = STEPS.map((step, i) => {
      return setTimeout(() => setStepIdx(i), cumulative)
      cumulative += step.duration
    })
    // Actually build cumulative properly
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    let cum = 0
    const timers = STEPS.map((step, i) => {
      const t = setTimeout(() => setStepIdx(i), cum)
      cum += step.duration
      return t
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,14,26,0.92)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: 460,
          padding: '48px 40px',
          background: '#0d1117',
          border: '1px solid #21262d',
          borderRadius: 20,
          boxShadow: '0 0 60px rgba(0,212,255,0.1)',
        }}
      >
        {/* Animated chart-line SVG */}
        <svg width="200" height="60" viewBox="0 0 200 60" style={{ marginBottom: 24 }}>
          <polyline
            points="0,50 30,35 60,42 90,20 120,28 150,10 180,18 200,8"
            fill="none"
            stroke="#00d4ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 400,
              strokeDashoffset: 0,
              animation: 'dash 2s ease-in-out infinite alternate',
            }}
          />
          <defs>
            <style>{`
              @keyframes dash {
                from { stroke-dashoffset: 400; }
                to   { stroke-dashoffset: 0; }
              }
            `}</style>
          </defs>
        </svg>

        {/* Spinner */}
        <div
          style={{
            width: 48,
            height: 48,
            margin: '0 auto 24px',
            borderRadius: '50%',
            border: '3px solid #21262d',
            borderTopColor: '#00d4ff',
            animation: 'spin 0.8s linear infinite',
          }}
        />

        <p
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#e6edf3',
            marginBottom: 8,
          }}
        >
          {STEPS[stepIdx]?.label}{dots}
        </p>

        {/* Step progress dots */}
        <div
          style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === stepIdx ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i <= stepIdx ? '#00d4ff' : '#21262d',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
