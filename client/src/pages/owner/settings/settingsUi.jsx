/** Shared Settings module presentation tokens — HDN Car admin. */

export const settingsUi = {
  shell:
    'relative overflow-hidden rounded-[1.5rem] border border-borderColor/70 bg-white shadow-[0_24px_60px_-42px_rgba(22,18,16,0.45)]',
  card:
    'rounded-[1.35rem] border border-borderColor/70 bg-white shadow-[0_16px_40px_-34px_rgba(22,18,16,0.4)]',
  cardSoft:
    'rounded-[1.35rem] border border-borderColor/60 bg-gradient-to-br from-white via-white to-sand/35',
  sectionLabel: 'text-[11px] font-semibold uppercase tracking-[0.14em] text-muted',
  title: 'font-display text-xl sm:text-2xl font-medium text-ink leading-tight',
  subtitle: 'text-sm text-muted leading-relaxed',
  input:
    'w-full max-w-full min-h-12 min-w-0 rounded-2xl border border-borderColor/80 bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(165, 22, 36,0.08)] disabled:bg-light disabled:text-muted',
  textarea:
    'w-full max-w-full min-w-0 rounded-2xl border border-borderColor/80 bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(165, 22, 36,0.08)] resize-y min-h-[6.5rem]',
  select:
    'w-full max-w-full min-h-12 min-w-0 rounded-2xl border border-borderColor/80 bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(165, 22, 36,0.08)]',
  btnPrimary:
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-white transition hover:bg-primary-dull active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55',
  btnSecondary:
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-borderColor/90 bg-white px-5 text-[15px] font-semibold text-ink transition hover:bg-light active:scale-[0.99] disabled:opacity-55',
  btnGhost:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/10 px-4 text-sm font-medium text-ink transition hover:border-primary/40 hover:text-primary',
  btnDanger:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100',
  chip: 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
  /** Mobile sticky footer — keep inside padded parent (no negative margins). */
  stickyBar:
    'sticky bottom-0 z-20 border-t border-borderColor/70 bg-white/95 px-3 py-3 backdrop-blur-md booking-safe-bottom sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none',
}

export const Field = ({ label, hint, error, children, className = '' }) => (
  <div className={`space-y-1.5 min-w-0 ${className}`}>
    {label ? <label className={settingsUi.sectionLabel}>{label}</label> : null}
    {children}
    {error ? <p className="text-[12px] text-red-600 leading-snug">{error}</p> : null}
    {!error && hint ? <p className="text-[12px] text-muted/90 leading-snug">{hint}</p> : null}
  </div>
)

export const SettingsCard = ({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
  soft = false,
}) => (
  <section className={`${soft ? settingsUi.cardSoft : settingsUi.card} p-4 sm:p-6 ${className}`}>
    {(eyebrow || title || description || action) && (
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className={`${settingsUi.sectionLabel} text-primary`}>{eyebrow}</p> : null}
          {title ? <h2 className={`${settingsUi.title} mt-1`}>{title}</h2> : null}
          {description ? <p className={`${settingsUi.subtitle} mt-1.5 max-w-2xl`}>{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    )}
    {children}
  </section>
)

export const StatusPill = ({ tone = 'neutral', children }) => {
  const tones = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    info: 'bg-sky-50 text-sky-800 border-sky-200/80',
    warn: 'bg-amber-50 text-amber-900 border-amber-200/80',
    danger: 'bg-red-50 text-red-700 border-red-200/80',
    neutral: 'bg-sand/80 text-ink/70 border-borderColor',
  }
  return (
    <span className={`${settingsUi.chip} ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

export const EmptyState = ({ title, body, action }) => (
  <div className="rounded-[1.35rem] border border-dashed border-borderColor bg-light/50 px-5 py-12 text-center">
    <p className="font-display text-xl text-ink">{title}</p>
    {body ? <p className="mt-2 text-sm text-muted max-w-md mx-auto leading-relaxed">{body}</p> : null}
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
  </div>
)

export const LoadingBlock = ({ label }) => (
  <div className="space-y-3 animate-pulse" aria-busy="true">
    <div className="h-4 w-40 rounded bg-sand" />
    <div className="h-28 rounded-[1.25rem] bg-sand/70" />
    <div className="h-28 rounded-[1.25rem] bg-sand/50" />
    {label ? <p className="text-sm text-muted">{label}</p> : null}
  </div>
)

export default settingsUi
