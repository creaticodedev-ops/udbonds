/**
 * Shared booking-flow UI tokens — keep Home / Cars / Details / Confirmation consistent.
 * Brand colors stay in CSS theme; these are spacing, control, and surface recipes only.
 */

export const booking = {
  /** Primary interactive height — 48px touch target */
  control: 'h-12',
  controlMin: 'min-h-12',

  /** Soft elevated surfaces */
  card:
    'rounded-[1.35rem] sm:rounded-3xl border border-borderColor/80 bg-surface shadow-[0_20px_50px_-28px_rgba(22,18,16,0.28)]',
  cardQuiet: 'rounded-2xl border border-borderColor/70 bg-white',

  /** Field chrome used on reservation + search */
  fieldShell:
    'flex h-12 w-full items-center gap-3 rounded-2xl border border-borderColor/80 bg-white px-3.5 text-[15px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition duration-200 focus-within:border-primary/35 focus-within:shadow-[0_0_0_3px_rgba(165, 22, 36,0.08)]',

  label: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted',
  eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-primary',
  sectionTitle: 'font-display text-2xl sm:text-3xl font-medium text-ink leading-tight',

  /** CTAs */
  btnPrimary:
    'inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-semibold text-[color:var(--color-on-primary,#fff)] transition hover:bg-primary-dull active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55',
  btnSecondary:
    'inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-borderColor/90 bg-white px-6 text-[15px] font-semibold text-ink transition hover:bg-light active:scale-[0.99]',
  btnGhost:
    'inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-ink/10 px-6 text-[15px] font-medium text-ink transition hover:border-primary hover:text-primary',

  chip:
    'inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs sm:text-sm font-medium transition-colors',
  chipActive: 'bg-ink text-white border-ink',
  chipIdle: 'bg-white/90 text-muted border-borderColor hover:border-ink/25 hover:text-ink',
  chipPrimaryActive: 'bg-primary text-white border-primary',

  pageBottom: 'pb-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))] sm:pb-24',
}

export default booking
