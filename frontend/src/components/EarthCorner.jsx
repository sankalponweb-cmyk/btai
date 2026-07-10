import { useEffect, useRef } from 'react'

// ── Build a 512×256 Earth surface texture once ──────────────────────────────
function buildTexture() {
  const W = 512, H = 256
  const oc = document.createElement('canvas')
  oc.width = W; oc.height = H
  const cx = oc.getContext('2d')

  // Deep ocean base
  cx.fillStyle = '#0a3d6b'
  cx.fillRect(0, 0, W, H)

  // Ocean depth variation (lighter near equator)
  const og = cx.createLinearGradient(0, 0, 0, H)
  og.addColorStop(0,    'rgba(5,25,60,0.5)')
  og.addColorStop(0.35, 'rgba(15,70,130,0.3)')
  og.addColorStop(0.5,  'rgba(20,90,155,0.4)')
  og.addColorStop(0.65, 'rgba(15,70,130,0.3)')
  og.addColorStop(1,    'rgba(5,25,60,0.5)')
  cx.fillStyle = og
  cx.fillRect(0, 0, W, H)

  // ── Continents (lon/lat → pixel) ──────────────────────────────────────
  // lonToX: lon [-180,180] → x [0,W]; latToY: lat [90,-90] → y [0,H]
  const lx = lon => ((lon + 180) / 360) * W
  const ly = lat => ((90 - lat) / 180) * H

  const ellipse = (lon, lat, dlon, dlat, color, alpha = 1) => {
    cx.globalAlpha = alpha
    cx.fillStyle = color
    cx.beginPath()
    cx.ellipse(lx(lon), ly(lat), (dlon/360)*W, (dlat/180)*H, 0, 0, Math.PI*2)
    cx.fill()
    cx.globalAlpha = 1
  }

  const poly = (pts, color) => {
    cx.fillStyle = color
    cx.beginPath()
    pts.forEach(([lon, lat], i) => i === 0 ? cx.moveTo(lx(lon), ly(lat)) : cx.lineTo(lx(lon), ly(lat)))
    cx.closePath()
    cx.fill()
  }

  // ── North America ─────────────────────────────────────────────────────
  poly([[-140,70],[-60,70],[-55,48],[-70,42],[-80,25],[-90,15],[-85,10],[-100,20],[-120,32],[-130,50],[-160,60]], '#2d6b28')
  // Alaska
  poly([[-170,72],[-140,72],[-140,60],[-155,55],[-170,60]], '#2d6b28')
  // Greenland
  ellipse(-42, 72, 18, 12, '#ccd8cc')
  // Iceland
  ellipse(-18, 65, 4, 2.5, '#b8c8b0')
  // Mexico / Central Am
  poly([[-120,32],[-85,25],[-77,8],[-82,8],[-90,15],[-100,20]], '#3a7a2a')

  // ── South America ─────────────────────────────────────────────────────
  poly([[-80,12],[-60,12],[-50,0],[-38,-12],[-40,-55],[-65,-55],[-78,-40],[-80,-20],[-78,0]], '#3d7a25')
  // Amazon forest (slightly brighter green)
  ellipse(-58, -3, 16, 8, '#4a9030', 0.7)

  // ── Europe ────────────────────────────────────────────────────────────
  poly([[0,72],[30,72],[40,60],[30,48],[20,42],[10,44],[0,48],[-5,55],[10,58],[0,62]], '#4a8232')
  // UK
  ellipse(-2, 54, 3, 5, '#4a8232')
  // Scandinavia
  poly([[5,58],[10,58],[15,70],[30,72],[18,64],[8,62]], '#4a8232')

  // ── Africa ───────────────────────────────────────────────────────────
  poly([[-18,16],[40,16],[52,12],[50,-26],[32,-35],[18,-35],[12,-18],[0,4],[-18,16]], '#5a9030')
  // Sahara tint
  poly([[-18,16],[30,16],[36,24],[20,37],[10,37],[-5,35],[-18,22]], '#8aaa40', )
  cx.globalAlpha = 0.35
  cx.fillStyle = '#c8a060'
  cx.beginPath()
  ;[[-18,16],[30,16],[36,24],[20,37],[10,37],[-5,35],[-18,22]].forEach(([lon, lat], i) => i===0?cx.moveTo(lx(lon),ly(lat)):cx.lineTo(lx(lon),ly(lat)))
  cx.closePath(); cx.fill()
  cx.globalAlpha = 1

  // Madagascar
  ellipse(47, -20, 3, 6, '#4a8232')

  // ── Asia ─────────────────────────────────────────────────────────────
  poly([[40,72],[180,72],[180,10],[140,0],[120,5],[100,0],[80,8],[60,15],[40,38],[30,48],[40,60]], '#3a7028')
  // India
  poly([[68,36],[78,36],[82,28],[80,8],[68,8],[64,22]], '#4a8030')
  // Southeast Asia
  poly([[100,22],[120,22],[120,0],[105,0],[100,10]], '#4a8030')
  // Japan
  ellipse(138, 36, 3, 8, '#3a7028')
  // Sri Lanka
  ellipse(81, 8, 1.5, 2, '#4a8030')
  // Philippines
  ellipse(122, 12, 3, 6, '#4a8030')

  // ── Indonesia / Maritime SE Asia ──────────────────────────────────────
  ellipse(110, -7, 10, 4, '#4a8030')  // Java/Sumatra
  ellipse(130, -2, 8,  5, '#4a8030')  // Borneo
  ellipse(140, -5, 6,  5, '#4a8030')  // Sulawesi/PNG

  // ── Australia ────────────────────────────────────────────────────────
  poly([[114,-22],[154,-22],[152,-40],[142,-38],[130,-32],[114,-30]], '#7aaa3a')
  // Outback tint
  cx.globalAlpha = 0.4
  cx.fillStyle = '#c89050'
  cx.beginPath()
  ;[[120,-22],[144,-22],[140,-34],[128,-32]].forEach(([lon, lat], i) => i===0?cx.moveTo(lx(lon),ly(lat)):cx.lineTo(lx(lon),ly(lat)))
  cx.closePath(); cx.fill()
  cx.globalAlpha = 1
  // New Zealand
  ellipse(172, -42, 2, 6, '#4a8232')

  // ── Antarctica ───────────────────────────────────────────────────────
  cx.fillStyle = '#dde8dd'
  cx.fillRect(0, ly(-70), W, H - ly(-70))
  // Add texture variation
  cx.globalAlpha = 0.3
  cx.fillStyle = '#c8d8c8'
  cx.fillRect(0, ly(-75), W, H - ly(-75))
  cx.globalAlpha = 1

  // ── Arctic ────────────────────────────────────────────────────────────
  cx.fillStyle = '#ccd8cc'
  cx.fillRect(0, 0, W, ly(78))

  return oc
}

// ── City light positions [lon, lat] ────────────────────────────────────────
const CITIES = [
  // North America East
  [-74,41],[-77,39],[-71,42],[-80,44],[-84,40],[-87,42],[-93,45],[-95,30],
  // North America West
  [-118,34],[-122,37],[-123,49],[-104,40],[-112,33],
  // Europe
  [2,49],[13,52],[18,50],[37,56],[24,61],[10,54],[4,52],[1,51],[-4,40],[12,42],[2,41],[15,38],
  // East Asia
  [121,31],[116,40],[127,38],[139,36],[129,35],[106,30],[114,22],
  // South Asia
  [72,19],[77,29],[80,13],[88,22],[67,25],
  // Middle East
  [36,34],[44,30],[51,24],[55,25],[46,25],
  // Australia
  [151,-34],[145,-38],[115,-32],
  // South America
  [-46,-24],[-58,-34],[-70,-34],[-77,-12],[-66,10],
]

export default function EarthCorner() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const texture = buildTexture()
    const texCtx = texture.getContext('2d')
    const TW = texture.width, TH = texture.height

    const S = canvas.width
    // Render at half res for performance, then scale
    const RES = S / 2
    const offscreen = document.createElement('canvas')
    offscreen.width = RES; offscreen.height = RES
    const oc = offscreen.getContext('2d')

    // Globe centre — offset so only bottom-right quarter shows
    const R = RES * 0.86
    const CX = RES * 1.03
    const CY = RES * 1.03

    // Sun direction (fixed upper-left)
    const SUN = { x: -0.55, y: -0.65, z: 0.52 }
    const sunLen = Math.sqrt(SUN.x**2 + SUN.y**2 + SUN.z**2)
    SUN.x /= sunLen; SUN.y /= sunLen; SUN.z /= sunLen

    let angle = 0
    let raf

    const draw = () => {
      oc.clearRect(0, 0, RES, RES)

      const imgData = oc.createImageData(RES, RES)
      const data = imgData.data
      const texImg = texCtx.getImageData(0, 0, TW, TH)
      const texData = texImg.data

      const cosA = Math.cos(angle), sinA = Math.sin(angle)

      for (let py = 0; py < RES; py++) {
        for (let px = 0; px < RES; px++) {
          const dx = px - CX, dy = py - CY
          const d2 = dx*dx + dy*dy
          if (d2 > R*R) continue   // outside sphere

          const dz = Math.sqrt(R*R - d2)
          // Unit normal in view space
          const nx = dx/R, ny = dy/R, nz = dz/R

          // Rotate around Y axis
          const nx2 = nx*cosA + nz*sinA
          const nz2 = -nx*sinA + nz*cosA

          // Lon/lat from rotated normal
          const lon = Math.atan2(nx2, nz2)             // -π .. π
          const lat = Math.asin(-ny)                    // -π/2 .. π/2

          // Texture UV
          const tu = Math.floor(((lon / (Math.PI*2) + 0.5) % 1) * TW)
          const tv = Math.floor((0.5 - lat/Math.PI) * TH)
          const ti = (Math.min(tv, TH-1) * TW + Math.min(tu, TW-1)) * 4
          let r = texData[ti], g = texData[ti+1], b = texData[ti+2]

          // Diffuse lighting: dot(normal, sun)
          const diff = Math.max(0, nx2*SUN.x + ny*SUN.y + nz2*SUN.z)
          // Ambient
          const amb = 0.06
          // Night side
          const lit = diff > 0.04 ? amb + diff * 0.94 : 0

          if (lit < 0.04) {
            // Night side — show city glow
            r = Math.round(r * 0.03)
            g = Math.round(g * 0.03)
            b = Math.round(b * 0.03)
          } else {
            // Specular on ocean (blue-ish pixels)
            let spec = 0
            if (b > r + 20 && b > g - 10) {
              const refl_z = 2*nz2*SUN.z - SUN.z
              const refl_x = 2*nx2*SUN.x - SUN.x
              spec = Math.pow(Math.max(0, refl_z + refl_x * 0.1), 28) * 0.6
            }
            r = Math.min(255, Math.round(r * lit + spec * 255))
            g = Math.min(255, Math.round(g * lit + spec * 255))
            b = Math.min(255, Math.round(b * lit + spec * 255 * 0.92))
          }

          const idx = (py * RES + px) * 4
          data[idx]   = r
          data[idx+1] = g
          data[idx+2] = b
          data[idx+3] = 255
        }
      }

      oc.putImageData(imgData, 0, 0)

      // ── City lights overlay ──────────────────────────────────────────
      CITIES.forEach(([lon0, lat0]) => {
        const lonR = (lon0 * Math.PI / 180) + angle
        const latR = lat0 * Math.PI / 180
        const x3 = Math.cos(latR) * Math.sin(lonR)
        const y3 = -Math.sin(latR)
        const z3 = Math.cos(latR) * Math.cos(lonR)
        if (z3 < 0) return
        const diff = x3*SUN.x + y3*SUN.y + z3*SUN.z
        if (diff > 0.05) return  // daytime — no lights visible
        const nightDepth = Math.min(1, Math.max(0, (-diff - 0.05) / 0.35))
        if (nightDepth < 0.1) return
        const px = CX + x3 * R, py = CY + y3 * R
        const g2 = oc.createRadialGradient(px, py, 0, px, py, R*0.028)
        g2.addColorStop(0,   `rgba(255,240,140,${nightDepth * 0.9})`)
        g2.addColorStop(0.5, `rgba(255,200,80,${nightDepth * 0.35})`)
        g2.addColorStop(1,   'rgba(255,160,40,0)')
        oc.fillStyle = g2
        oc.beginPath()
        oc.arc(px, py, R*0.028, 0, Math.PI*2)
        oc.fill()
      })

      // ── Composite to main canvas scaled up ───────────────────────────
      ctx.clearRect(0, 0, S, S)
      ctx.drawImage(offscreen, 0, 0, S, S)

      // ── Atmosphere glow (drawn at full res) ───────────────────────────
      const scale = S / RES
      const FCX = CX * scale, FCY = CY * scale, FR = R * scale

      const atmo = ctx.createRadialGradient(FCX, FCY, FR*0.91, FCX, FCY, FR*1.10)
      atmo.addColorStop(0,    'rgba(60,140,255,0.0)')
      atmo.addColorStop(0.28, 'rgba(80,165,255,0.32)')
      atmo.addColorStop(0.60, 'rgba(50,110,230,0.18)')
      atmo.addColorStop(1,    'rgba(20,60,200,0.0)')
      ctx.beginPath()
      ctx.arc(FCX, FCY, FR*1.10, 0, Math.PI*2)
      ctx.fillStyle = atmo
      ctx.fill()

      // Sunlit limb
      const limb = ctx.createRadialGradient(FCX - FR*0.68, FCY - FR*0.62, FR*0.55, FCX, FCY, FR*1.09)
      limb.addColorStop(0,    'rgba(120,200,255,0)')
      limb.addColorStop(0.72, 'rgba(90,170,255,0.10)')
      limb.addColorStop(0.86, 'rgba(60,130,240,0.22)')
      limb.addColorStop(1,    'rgba(40,100,220,0.0)')
      ctx.beginPath()
      ctx.arc(FCX, FCY, FR*1.09, 0, Math.PI*2)
      ctx.fillStyle = limb
      ctx.fill()

      angle += 0.00042
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={660}
      height={660}
      style={{
        position: 'fixed',
        bottom: -286,
        right: -286,
        width: 660,
        height: 660,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}
