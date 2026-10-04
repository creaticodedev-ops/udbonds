import { useEffect, useRef } from 'react'

const FINE_POINTER = '(pointer: fine)'
const REDUCE = '(prefers-reduced-motion: reduce)'

/**
 * Writes --hx / --hy on the stage (-1…1). No React state per frame.
 */
export const usePointerLook = (enabled = true) => {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    const fine = window.matchMedia(FINE_POINTER).matches
    const reduce = window.matchMedia(REDUCE).matches
    if (!fine || reduce) {
      el.style.setProperty('--hx', '0')
      el.style.setProperty('--hy', '0')
      return
    }

    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let raf = 0
    let running = true

    const tick = () => {
      if (!running) return
      current.x += (target.x - current.x) * 0.055
      current.y += (target.y - current.y) * 0.055
      if (Math.abs(current.x) < 0.001) current.x = 0
      if (Math.abs(current.y) < 0.001) current.y = 0
      el.style.setProperty('--hx', current.x.toFixed(4))
      el.style.setProperty('--hy', current.y.toFixed(4))
      raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }

    const onLeave = () => {
      target.x = 0
      target.y = 0
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [enabled])

  return ref
}
