import { useNavigate } from 'react-router-dom'

export default function NavLogo({ onClick }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={onClick ?? (() => navigate('/'))}
      style={{
        border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em',
        background: 'linear-gradient(135deg, #e6edf3 0%, #38bdf8 60%, #818cf8 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent', color: 'transparent',
      }}
    >
      backtest.ai
    </button>
  )
}
