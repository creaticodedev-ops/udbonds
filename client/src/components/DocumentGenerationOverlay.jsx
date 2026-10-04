import React, { useEffect, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext'

const MODE_COPY = {
  finalize: {
    titleKey: 'docGen.finalizeTitle',
    runningKey: 'docGen.finalizeRunning',
    successKey: 'docGen.finalizeSuccess',
    steps: [
      { id: 'signed', labelKey: 'docGen.stepSigned' },
      { id: 'generating', labelKey: 'docGen.stepGenerating' },
      { id: 'ready', labelKey: 'docGen.stepReady' },
    ],
  },
  regenerate: {
    titleKey: 'docGen.regenerateTitle',
    runningKey: 'docGen.regenerateRunning',
    successKey: 'docGen.regenerateSuccess',
    steps: [
      { id: 'saving', labelKey: 'docGen.stepSaving' },
      { id: 'generating', labelKey: 'docGen.stepRegenerating' },
      { id: 'ready', labelKey: 'docGen.stepUpdated' },
    ],
  },
  generate: {
    titleKey: 'docGen.generateTitle',
    runningKey: 'docGen.generateRunning',
    successKey: 'docGen.generateSuccess',
    steps: [
      { id: 'preparing', labelKey: 'docGen.stepPreparing' },
      { id: 'generating', labelKey: 'docGen.stepGenerating' },
      { id: 'ready', labelKey: 'docGen.stepReady' },
    ],
  },
}

/**
 * Premium document-generation overlay.
 * Progress bar is indeterminate while `status === 'running'` and completes only on real success.
 */
const DocumentGenerationOverlay = ({
  open,
  status = 'idle',
  mode = 'regenerate',
  error = '',
  pdfUrl = '',
  onRetry,
  onDismiss,
  autoDismissMs = 0,
  embedPdf = false,
  position = 'absolute',
}) => {
  const { t } = useI18n()
  const copy = MODE_COPY[mode] || MODE_COPY.regenerate

  useEffect(() => {
    if (!open || status !== 'success' || !autoDismissMs || !onDismiss) return undefined
    const timer = window.setTimeout(onDismiss, autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [open, status, autoDismissMs, onDismiss])

  const steps = useMemo(() => {
    const list = copy.steps
    return list.map((step, index) => {
      let state = 'pending'
      if (status === 'error') {
        if (index === 0) state = 'done'
        else if (index === 1) state = 'error'
        else state = 'pending'
      } else if (status === 'success') {
        state = 'done'
      } else if (status === 'running') {
        if (index === 0) state = 'done'
        else if (index === 1) state = 'active'
        else state = 'pending'
      }
      return { ...step, state }
    })
  }, [copy.steps, status])

  if (!open) return null

  const headline =
    status === 'error'
      ? t('docGen.failedTitle')
      : status === 'success'
        ? t(copy.successKey)
        : t(copy.titleKey)

  const detail =
    status === 'error'
      ? (error || t('docGen.failedBody'))
      : status === 'success'
        ? t('docGen.successBody')
        : t(copy.runningKey)

  const shellClass = position === 'fixed'
    ? 'fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6'
    : 'absolute inset-0 z-[60] flex items-center justify-center p-4 sm:p-6'

  return (
    <div
      className={shellClass}
      role="status"
      aria-live="polite"
      aria-busy={status === 'running'}
    >
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" aria-hidden="true" />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-borderColor/80 bg-white shadow-[0_28px_80px_-36px_rgba(22,18,16,0.55)]">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {t('docGen.eyebrow')}
          </p>
          <h3 className="mt-1.5 font-display text-xl text-ink leading-snug sm:text-[1.35rem]">
            {headline}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>

          {/* Real-request progress: indeterminate until backend finishes */}
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-sand">
            {status === 'running' && (
              <div className="docgen-bar-running h-full rounded-full bg-primary" />
            )}
            {status === 'success' && (
              <div className="h-full w-full rounded-full bg-primary transition-[width] duration-500 ease-out" />
            )}
            {status === 'error' && (
              <div className="h-full w-full rounded-full bg-red-600/80" />
            )}
          </div>

          <ol className="mt-5 space-y-2.5">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-3 text-sm">
                <span
                  className={[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    step.state === 'done' && 'bg-emerald-600 text-white',
                    step.state === 'active' && 'bg-primary text-white',
                    step.state === 'error' && 'bg-red-600 text-white',
                    step.state === 'pending' && 'bg-sand text-muted',
                  ].filter(Boolean).join(' ')}
                  aria-hidden="true"
                >
                  {step.state === 'done' ? '✓' : step.state === 'error' ? '!' : step.state === 'active' ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  ) : (
                    ''
                  )}
                </span>
                <span
                  className={
                    step.state === 'active'
                      ? 'font-medium text-ink'
                      : step.state === 'done'
                        ? 'text-ink'
                        : step.state === 'error'
                          ? 'font-medium text-red-700'
                          : 'text-muted'
                  }
                >
                  {t(step.labelKey)}
                  {step.state === 'active' ? ` ${t('docGen.pleaseWait')}` : ''}
                </span>
              </li>
            ))}
          </ol>

          {status === 'success' && embedPdf && pdfUrl && (
            <div className="mt-4 overflow-hidden rounded-xl border border-borderColor bg-sand/40">
              <iframe
                title={t('docGen.pdfPreview')}
                src={pdfUrl}
                className="h-48 w-full bg-white"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-borderColor/80 bg-light/50 px-5 py-3 sm:px-6">
          {status === 'error' && (
            <>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-xl border border-borderColor px-3.5 py-2 text-sm text-ink hover:bg-white"
                >
                  {t('docGen.keepEditing')}
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-dull"
                >
                  {t('docGen.retry')}
                </button>
              )}
            </>
          )}
          {status === 'success' && (
            <>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-borderColor px-3.5 py-2 text-sm text-ink hover:bg-white"
                >
                  {t('docGen.openPdf')}
                </a>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-dull"
                >
                  {t('docGen.continue')}
                </button>
              )}
            </>
          )}
          {status === 'running' && (
            <p className="w-full text-center text-xs text-muted sm:text-right">
              {t('docGen.doNotClose')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DocumentGenerationOverlay
