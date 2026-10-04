import { useEffect, useState } from 'react'

export const usePrefersReducedMotion = () => {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduce(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduce
}

export const useInViewActive = (ref, { rootMargin = '80px' } = {}) => {
  const [active, setActive] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      { rootMargin, threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return active
}
