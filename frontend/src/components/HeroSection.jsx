import { useEffect, useRef } from 'react'

export default function HeroSection() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Deep field star layers (3 depth planes) ───────────────────────────
    // Far layer: thousands of tiny, barely-visible specks — the cosmic web
    const FAR_STARS = Array.from({ length: 900 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.5 + 0.1,
      alpha: Math.random() * 0.35 + 0.05,
      twinkle: Math.random() * 0.008 + 0.002,
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.000015,
    }))

    // Mid layer: moderate stars with subtle colour
    const MID_STARS = Array.from({ length: 320 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.9 + 0.35,
      alpha: Math.random() * 0.55 + 0.20,
      twinkle: Math.random() * 0.012 + 0.004,
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.000025,
      hue: 210 + Math.random() * 50,
    }))

    // Near layer: a handful of bright foreground stars with cross-flares
    const NEAR_STARS = Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 1.2,
      alpha: Math.random() * 0.5 + 0.5,
      twinkle: Math.random() * 0.018 + 0.006,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.3 ? 40 + Math.random() * 20 : 200 + Math.random() * 60,
    }))

    // ── Milky Way band ────────────────────────────────────────────────────
    // A diagonal smear of clustered micro-stars
    const BAND_STARS = Array.from({ length: 600 }, () => {
      const t = Math.random()
      // Band runs diagonally from top-right to bottom-left
      const bandX = 0.15 + t * 0.85 + (Math.random() - 0.5) * 0.28
      const bandY = t * 0.75 + (Math.random() - 0.5) * 0.22
      return {
        x: bandX,
        y: bandY,
        r: Math.random() * 0.45 + 0.05,
        alpha: Math.random() * 0.22 + 0.03,
        phase: Math.random() * Math.PI * 2,
        twinkle: Math.random() * 0.006,
      }
    })

    // ── Distant nebulae (very faint, far away) ────────────────────────────
    const NEBULAE = [
      { cx: 0.12, cy: 0.22, rx: 0.45, ry: 0.28, color: '60,0,180',   alpha: 0.028, rot: 0,   rotSpeed: 0.00008 },
      { cx: 0.82, cy: 0.68, rx: 0.40, ry: 0.30, color: '0,100,200',  alpha: 0.022, rot: 0.8, rotSpeed: -0.00006 },
      { cx: 0.50, cy: 0.90, rx: 0.55, ry: 0.22, color: '0,180,120',  alpha: 0.018, rot: 0.3, rotSpeed: 0.00005 },
      { cx: 0.92, cy: 0.10, rx: 0.30, ry: 0.22, color: '180,40,120', alpha: 0.020, rot: 1.5, rotSpeed: 0.00007 },
      { cx: 0.30, cy: 0.60, rx: 0.32, ry: 0.20, color: '40,60,200',  alpha: 0.018, rot: 0.6, rotSpeed: -0.00005 },
      { cx: 0.65, cy: 0.30, rx: 0.28, ry: 0.18, color: '100,0,160',  alpha: 0.015, rot: 2.0, rotSpeed: 0.00004 },
    ]

    // ── Shooting stars ────────────────────────────────────────────────────
    let shooters = []
    let lastShoot = 0

    const spawnShooter = () => ({
      x: Math.random() * 1.3 - 0.15,
      y: Math.random() * 0.5 - 0.05,
      len: Math.random() * 0.18 + 0.08,
      speed: Math.random() * 0.005 + 0.003,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.25,
      alpha: 1,
      fade: Math.random() * 0.012 + 0.007,
      width: Math.random() * 0.8 + 0.4,
    })

    let t = 0
    let raf

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      t++

      ctx.clearRect(0, 0, W, H)

      // 1. Void — pure black
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // 2. Milky Way glow band (soft luminous smear before individual stars)
      ctx.save()
      ctx.translate(W * 0.5, H * 0.5)
      ctx.rotate(-0.45)
      const mw = ctx.createLinearGradient(-W * 0.8, 0, W * 0.8, 0)
      mw.addColorStop(0,    'rgba(255,255,255,0)')
      mw.addColorStop(0.35, 'rgba(180,200,255,0.022)')
      mw.addColorStop(0.5,  'rgba(200,210,255,0.040)')
      mw.addColorStop(0.65, 'rgba(180,200,255,0.022)')
      mw.addColorStop(1,    'rgba(255,255,255,0)')
      ctx.fillStyle = mw
      ctx.fillRect(-W * 0.8, -H * 0.35, W * 1.6, H * 0.70)
      ctx.restore()

      // 3. Distant nebulae
      NEBULAE.forEach(n => {
        n.rot += n.rotSpeed
        ctx.save()
        ctx.translate(n.cx * W, n.cy * H)
        ctx.rotate(n.rot)
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, n.rx * W)
        g.addColorStop(0,   `rgba(${n.color},${n.alpha})`)
        g.addColorStop(0.4, `rgba(${n.color},${n.alpha * 0.35})`)
        g.addColorStop(1,   `rgba(${n.color},0)`)
        ctx.scale(1, n.ry / n.rx)
        ctx.beginPath()
        ctx.arc(0, 0, n.rx * W, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
        ctx.restore()
      })

      // 4. Far stars (cosmic web — barely visible)
      FAR_STARS.forEach(s => {
        s.phase += s.twinkle
        s.x += s.drift
        if (s.x > 1.01) s.x = -0.01
        if (s.x < -0.01) s.x = 1.01
        const a = s.alpha * (0.7 + 0.3 * Math.sin(s.phase))
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,215,255,${a})`
        ctx.fill()
      })

      // 5. Milky Way band stars
      BAND_STARS.forEach(s => {
        s.phase += s.twinkle
        const a = s.alpha * (0.6 + 0.4 * Math.sin(s.phase))
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(220,225,255,${a})`
        ctx.fill()
      })

      // 6. Mid stars with colour
      MID_STARS.forEach(s => {
        s.phase += s.twinkle
        s.x += s.drift
        if (s.x > 1.01) s.x = -0.01
        if (s.x < -0.01) s.x = 1.01
        const twinkle = 0.5 + 0.5 * Math.sin(s.phase)
        const a = s.alpha * (0.55 + 0.45 * twinkle)
        const sx = s.x * W, sy = s.y * H
        if (s.r > 0.8) {
          // Soft halo
          const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 4)
          halo.addColorStop(0, `hsla(${s.hue},60%,85%,${a * 0.25})`)
          halo.addColorStop(1, 'transparent')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(sx, sy, s.r * 4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue},55%,92%,${a})`
        ctx.fill()
      })

      // 7. Near bright stars with cross-flare diffraction spikes
      NEAR_STARS.forEach(s => {
        s.phase += s.twinkle
        const twinkle = 0.6 + 0.4 * Math.sin(s.phase)
        const a = s.alpha * twinkle
        const sx = s.x * W, sy = s.y * H
        const glow = s.r * (2 + twinkle)

        // Outer glow
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, glow * 5)
        halo.addColorStop(0,   `hsla(${s.hue},70%,90%,${a * 0.45})`)
        halo.addColorStop(0.4, `hsla(${s.hue},60%,80%,${a * 0.12})`)
        halo.addColorStop(1,   'transparent')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(sx, sy, glow * 5, 0, Math.PI * 2)
        ctx.fill()

        // Diffraction spike (horizontal + vertical cross)
        const spikeLen = glow * 10
        const spikeAlpha = a * 0.20
        ;[[1,0],[0,1]].forEach(([dx, dy]) => {
          const spike = ctx.createLinearGradient(sx - dx*spikeLen, sy - dy*spikeLen, sx + dx*spikeLen, sy + dy*spikeLen)
          spike.addColorStop(0,   'transparent')
          spike.addColorStop(0.45, `hsla(${s.hue},80%,95%,${spikeAlpha})`)
          spike.addColorStop(0.5,  `hsla(${s.hue},80%,98%,${a * 0.55})`)
          spike.addColorStop(0.55, `hsla(${s.hue},80%,95%,${spikeAlpha})`)
          spike.addColorStop(1,   'transparent')
          ctx.strokeStyle = spike
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(sx - dx*spikeLen, sy - dy*spikeLen)
          ctx.lineTo(sx + dx*spikeLen, sy + dy*spikeLen)
          ctx.stroke()
        })

        // Core dot
        ctx.beginPath()
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue},50%,98%,${a})`
        ctx.fill()
      })

      // 8. Shooting stars
      const now = performance.now()
      const interval = 1800 + Math.random() * 1200
      if (now - lastShoot > interval && shooters.length < 2) {
        shooters.push(spawnShooter())
        lastShoot = now
      }
      shooters = shooters.filter(s => s.alpha > 0)
      shooters.forEach(s => {
        const sx = s.x * W, sy = s.y * H
        const ex = sx + Math.cos(s.angle) * s.len * W
        const ey = sy + Math.sin(s.angle) * s.len * W
        const grad = ctx.createLinearGradient(sx, sy, ex, ey)
        grad.addColorStop(0,    'rgba(255,255,255,0)')
        grad.addColorStop(0.4,  `rgba(180,220,255,${s.alpha * 0.4})`)
        grad.addColorStop(1,    `rgba(255,255,255,${s.alpha})`)
        ctx.beginPath()
        ctx.moveTo(sx, sy); ctx.lineTo(ex, ey)
        ctx.strokeStyle = grad
        ctx.lineWidth = s.width
        ctx.lineCap = 'round'
        ctx.stroke()
        s.x += Math.cos(s.angle) * s.speed
        s.y += Math.sin(s.angle) * s.speed
        s.alpha -= s.fade
      })

      // 9. Deep vignette — draws the eye to centre, enhances depth
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, Math.max(W,H) * 0.75)
      vig.addColorStop(0,   'rgba(0,0,0,0)')
      vig.addColorStop(0.6, 'rgba(1,0,6,0.20)')
      vig.addColorStop(1,   'rgba(1,0,8,0.78)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
