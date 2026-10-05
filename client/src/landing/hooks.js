import { useEffect, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Adds `.is-in` to every `[data-reveal]` element once it enters the viewport. Re-scans when `rescanKey` changes. */
export const useReveal = (rescanKey) => {
  useEffect(() => {
    const elements = [...document.querySelectorAll('[data-reveal]:not(.is-in)')]
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-in'))
      return undefined
    }
    document.documentElement.classList.add('has-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [rescanKey])
}

/** Returns the id of the section currently crossing the middle of the viewport. */
export const useActiveSection = (ids) => {
  const [active, setActive] = useState(ids[0])
  const key = ids.join('|')

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    key.split('|').forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [key])

  return active
}

/** Writes scroll progress through `ref` (0 → 1) into the `--progress` CSS variable. */
export const useScrollProgress = (ref) => {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const height = el.offsetHeight || 1
      const progress = Math.min(1, Math.max(0, window.scrollY / height))
      el.style.setProperty('--progress', progress.toFixed(3))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref])
}

export const scrollToSection = (id) => {
  const target = id === 'top' ? document.body : document.getElementById(id)
  if (!target) return
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
  if (id === 'top') window.scrollTo({ top: 0, behavior })
  else target.scrollIntoView({ behavior, block: 'start' })
  window.history.replaceState(null, '', id === 'top' ? window.location.pathname : `#${id}`)
}
