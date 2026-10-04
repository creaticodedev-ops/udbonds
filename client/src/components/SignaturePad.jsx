import React, { useEffect, useRef, useState } from 'react'

/**
 * Lightweight browser signature pad — no external dependency.
 */
const SignaturePad = ({ onChange, className = '', disabled = false }) => {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const getCtx = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#161210'
    return ctx
  }

  const resize = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const ratio = window.devicePixelRatio || 1
    const width = parent?.clientWidth || 320
    const height = 160
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = getCtx()
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const pos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const src = e.touches?.[0] || e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const start = (e) => {
    if (disabled) return
    e.preventDefault()
    drawing.current = true
    const ctx = getCtx()
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e) => {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const ctx = getCtx()
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && onChange) onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange?.('')
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-borderColor bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full block cursor-crosshair bg-[linear-gradient(to_bottom,transparent_95%,#E2D9D6_95%)]"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted">{hasInk ? 'Signature captured' : 'Sign above using your mouse or finger'}</p>
        <button type="button" onClick={clear} disabled={disabled || !hasInk} className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-40">
          Clear
        </button>
      </div>
    </div>
  )
}

export default SignaturePad
