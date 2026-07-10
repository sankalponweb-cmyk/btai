import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import NavLogo from '../components/NavLogo.jsx'

const PACKS = [
  {
    key:     '5cr',
    credits: 5,
    price:   '₹499',
    perRun:  '₹99.8/run',
    discount: null,
    label:   'Starter',
  },
  {
    key:     '10cr',
    credits: 10,
    price:   '₹949',
    perRun:  '₹94.9/run',
    discount: '5% off',
    label:   'Standard',
    popular: true,
  },
  {
    key:     '25cr',
    credits: 25,
    price:   '₹2,249',
    perRun:  '₹89.9/run',
    discount: '10% off',
    label:   'Value',
  },
  {
    key:     '50cr',
    credits: 50,
    price:   '₹3,999',
    perRun:  '₹79.9/run',
    discount: '20% off',
    label:   'Power',
  },
]

export default function BuyCreditsPage() {
  const { user, credits, signInWithGoogle, getIdToken } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [error,   setError]   = useState('')

  const handleBuy = async (pack) => {
    if (!user) {
      await signInWithGoogle()
      return
    }

    setLoading(pack.key)
    setError('')

    try {
      const token = await getIdToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      // Step 1: create a Razorpay order on the backend
      const orderRes = await fetch('/api/billing/create-order', {
        method:  'POST',
        headers,
        body:    JSON.stringify({ pack: pack.key }),
      })
      const order = await orderRes.json()
      if (!orderRes.ok) {
        setError(order.detail || 'Could not create order. Please try again.')
        setLoading(null)
        return
      }

      // Step 2: open Razorpay modal
      const rzp = new window.Razorpay({
        key:         order.key_id,
        amount:      order.amount,
        currency:    order.currency,
        order_id:    order.order_id,
        name:        'Backtest.ai',
        description: `${pack.credits} Backtest Credits`,
        prefill:     { email: user.email || '' },
        theme:       { color: '#38bdf8' },

        handler: async ({ razorpay_payment_id, razorpay_order_id, razorpay_signature }) => {
          // Step 3: verify payment on the backend (HMAC check) and add credits
          try {
            const verifyRes = await fetch('/api/billing/verify-payment', {
              method:  'POST',
              headers,
              body:    JSON.stringify({
                payment_id: razorpay_payment_id,
                order_id:   razorpay_order_id,
                signature:  razorpay_signature,
                pack:       pack.key,
              }),
            })
            if (verifyRes.ok) {
              navigate('/account?success=1')   // Firestore onSnapshot updates credits live
            } else {
              const errData = await verifyRes.json().catch(() => ({}))
              setError(errData.detail || 'Payment verification failed. Contact support.')
            }
          } catch {
            setError('Network error during verification. Contact support with your payment ID.')
          } finally {
            setLoading(null)
          }
        },

        modal: {
          ondismiss: () => setLoading(null),
        },
      })

      rzp.open()
    } catch {
      setError('Network error. Please check your connection and try again.')
      setLoading(null)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d1117',
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#e6edf3',
        padding: '60px 24px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 900, margin: '0 auto 56px' }}>
        <NavLogo />
        {user && credits !== null && (
          <span style={{
            fontSize: 13, color: '#38bdf8',
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 20, padding: '4px 12px',
          }}>
            {credits} credits remaining
          </span>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            display: 'inline-block', padding: '5px 14px', borderRadius: 20,
            border: '1px solid rgba(56,189,248,0.35)', fontSize: 12,
            background: 'rgba(56,189,248,0.07)', marginBottom: 20, color: '#38bdf8',
          }}>
            Pay as you go — no subscriptions
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
            background: 'linear-gradient(135deg, #e6edf3 0%, #38bdf8 60%, #818cf8 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', margin: '0 0 16px',
          }}>
            Buy Backtest Credits
          </h1>
          <p style={{ color: '#8b949e', fontSize: 16, margin: 0 }}>
            1 credit = 1 backtest run. Credits never expire. New users get 3 free credits.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            maxWidth: 600, margin: '0 auto 32px',
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.25)',
            borderRadius: 10, padding: '12px 16px',
            textAlign: 'center', color: '#ff6b6b', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Credit packs grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
        }}>
          {PACKS.map((pack) => (
            <div
              key={pack.key}
              style={{
                position: 'relative',
                background: pack.popular ? 'rgba(56,189,248,0.05)' : '#161b22',
                border: pack.popular ? '1px solid rgba(56,189,248,0.4)' : '1px solid #30363d',
                borderRadius: 16,
                padding: '28px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'border-color 0.2s, transform 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = pack.popular ? 'rgba(56,189,248,0.7)' : '#38bdf8'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = pack.popular ? 'rgba(56,189,248,0.4)' : '#30363d'
                e.currentTarget.style.transform = 'none'
              }}
            >
              {pack.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  borderRadius: 20, padding: '3px 14px',
                  fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
                }}>
                  MOST POPULAR
                </div>
              )}

              {pack.discount && (
                <div style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  borderRadius: 20, padding: '2px 10px',
                  fontSize: 11, fontWeight: 700, color: '#34d399',
                }}>
                  {pack.discount}
                </div>
              )}

              <div>
                <p style={{ fontSize: 13, color: '#8b949e', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.06em' }}>
                  {pack.label.toUpperCase()}
                </p>
                <div style={{
                  fontSize: 36, fontWeight: 700, lineHeight: 1,
                  background: pack.popular
                    ? 'linear-gradient(135deg, #38bdf8, #818cf8)'
                    : 'linear-gradient(135deg, #e6edf3, #a0aec0)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {pack.credits}
                </div>
                <p style={{ fontSize: 13, color: '#8b949e', margin: '4px 0 0' }}>credits</p>
              </div>

              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3' }}>{pack.price}</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{pack.perRun}</div>
              </div>

              <button
                onClick={() => handleBuy(pack)}
                disabled={loading === pack.key}
                style={{
                  marginTop: 8, padding: '12px 0', borderRadius: 10,
                  border: pack.popular ? 'none' : '1px solid #30363d',
                  cursor: loading === pack.key ? 'wait' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
                  background: pack.popular
                    ? 'linear-gradient(135deg, #38bdf8, #818cf8)'
                    : 'transparent',
                  color: pack.popular ? '#fff' : '#e6edf3',
                  transition: 'all 0.2s',
                  boxShadow: pack.popular ? '0 4px 20px rgba(56,189,248,0.25)' : 'none',
                  opacity: loading === pack.key ? 0.7 : 1,
                }}
                onMouseEnter={e => {
                  if (!pack.popular && loading !== pack.key) {
                    e.currentTarget.style.borderColor = '#38bdf8'
                    e.currentTarget.style.background = 'rgba(56,189,248,0.08)'
                  }
                }}
                onMouseLeave={e => {
                  if (!pack.popular && loading !== pack.key) {
                    e.currentTarget.style.borderColor = '#30363d'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {loading === pack.key ? 'Opening…' : user ? 'Buy Now' : 'Sign in to Buy'}
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: '#484f58' }}>
          Payments powered by Razorpay. UPI, cards, and net banking accepted.
          Credits are added instantly after payment.
        </p>
      </div>
    </div>
  )
}
