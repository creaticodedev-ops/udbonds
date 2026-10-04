/** Shared premium form styling tokens */

export const formInputClass =
  'w-full rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-sm text-ink shadow-sm backdrop-blur-sm transition placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'

export const formInputOnLightClass =
  'w-full rounded-2xl border border-borderColor/80 bg-white px-4 py-3 text-sm text-ink shadow-[0_1px_0_rgba(22,18,16,0.04)] transition placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

export const formLabelClass = 'text-[11px] font-bold uppercase tracking-[0.14em] text-muted'

export const FormField = ({ label, hint, children, className = '' }) => (
  <label className={`flex flex-col gap-2 ${className}`}>
    <span className={formLabelClass}>{label}</span>
    {children}
    {hint ? <span className="text-[11px] text-muted/90 leading-snug">{hint}</span> : null}
  </label>
)

export const SectionCard = ({ title, subtitle, children, accent = 'from-primary/8 to-transparent' }) => (
  <section className={`rounded-3xl border border-borderColor/60 bg-gradient-to-br ${accent} p-5 sm:p-6 shadow-[0_24px_60px_-40px_rgba(22,18,16,0.45)]`}>
    {(title || subtitle) && (
      <header className="mb-5">
        {title ? <h3 className="font-display text-lg sm:text-xl text-ink">{title}</h3> : null}
        {subtitle ? <p className="mt-1 text-sm text-muted leading-relaxed">{subtitle}</p> : null}
      </header>
    )}
    {children}
  </section>
)

export const WhatsAppButton = ({ children, disabled, type = 'submit', onClick, className = '' }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#25D366] py-4 text-sm font-semibold text-white shadow-[0_12px_32px_-12px_rgba(37,211,102,0.65)] transition hover:bg-[#20bd5a] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition group-hover:bg-white/25 sm:h-9 sm:w-9">
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current sm:h-5 sm:w-5" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.918.918l4.458-1.495A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.714 9.714 0 01-4.97-1.357l-.355-.21-3.742 1.254 1.254-3.645-.231-.375A9.734 9.734 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
      </svg>
    </span>
    {children}
  </button>
)
