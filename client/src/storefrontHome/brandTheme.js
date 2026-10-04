const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
export const DEFAULT_PRIMARY = '#A51624'

const parseHex = (value) => {
  const raw = String(value || '').trim()
  if (!HEX.test(raw)) return null
  let hex = raw.slice(1)
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`

const luminance = ({ r, g, b }) => {
  const lin = [r, g, b].map((n) => {
    const c = n / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

const mix = (rgb, target, amount) => ({
  r: rgb.r + (target.r - rgb.r) * amount,
  g: rgb.g + (target.g - rgb.g) * amount,
  b: rgb.b + (target.b - rgb.b) * amount,
})

export const brandCssVars = (hex) => {
  const rgb = parseHex(hex) || parseHex(DEFAULT_PRIMARY)
  const dull = mix(rgb, { r: 0, g: 0, b: 0 }, 0.22)
  const onPrimary = luminance(rgb) > 0.55 ? '#161210' : '#FFFFFF'
  const glow = luminance(rgb) < 0.14 ? { r: 237, g: 232, b: 228 } : rgb
  return {
    '--color-primary': toHex(rgb),
    '--color-primary-dull': toHex(dull),
    '--color-on-primary': onPrimary,
    '--color-primary-rgb': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    '--color-brand-glow-rgb': `${glow.r}, ${glow.g}, ${glow.b}`,
  }
}

export const applyBrandCssVars = (hex, root = document.documentElement) => {
  const vars = brandCssVars(hex)
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value))
}

export const resetBrandCssVars = (root = document.documentElement) => {
  applyBrandCssVars(DEFAULT_PRIMARY, root)
}
