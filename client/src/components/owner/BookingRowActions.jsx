import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const iconClass = 'h-4 w-4 shrink-0'

const EyeIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z" />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
)

const PencilIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5" />
  </svg>
)

const IdIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="12" r="2" />
    <path strokeLinecap="round" d="M14 10.5h4M14 13.5h3" />
  </svg>
)

const PassportIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <circle cx="12" cy="10" r="2.5" />
    <path strokeLinecap="round" d="M8.5 16.5h7" />
  </svg>
)

const LicenseIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const PrintIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V3.75A.75.75 0 016.75 3h10.5a.75.75 0 01.75.75V9M6 18H5.25A2.25 2.25 0 013 15.75v-3A2.25 2.25 0 015.25 10.5h13.5A2.25 2.25 0 0121 12.75v3A2.25 2.25 0 0118.75 18H18" />
    <rect x="6" y="14.25" width="12" height="6.75" rx="1" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.82c0 1.96.52 3.8 1.43 5.4L2 22l4.95-1.52a9.9 9.9 0 004.99 1.34h.01c5.46 0 9.89-4.4 9.89-9.82C21.84 6.4 17.5 2 12.04 2zm5.75 14.15c-.24.68-1.4 1.25-1.93 1.33-.5.07-1.12.1-1.81-.11-.42-.13-.95-.3-1.64-.59-2.88-1.25-4.76-4.15-4.9-4.34-.15-.2-1.18-1.57-1.18-3 0-1.42.74-2.12 1.01-2.41.26-.28.58-.35.77-.35.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.07 1.31 2.36 1.46.3.15.47.12.64-.07.18-.2.74-.86.94-1.15.2-.3.4-.24.67-.14.27.1 1.72.81 2.02.96.3.15.5.22.57.34.08.13.08.74-.16 1.42z" />
  </svg>
)

const MoreIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
)

const TrashIcon = () => (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12M9.75 7.5V6.75A1.75 1.75 0 0111.5 5h1a1.75 1.75 0 011.75 1.75V7.5m-6.5 0l.6 10.05A1.75 1.75 0 009.6 19.25h4.8a1.75 1.75 0 001.75-1.7L16.75 7.5" />
  </svg>
)

const toolbarBtn =
  'inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-borderColor bg-white text-gray-600 transition ' +
  'hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 ' +
  'disabled:pointer-40 disabled:pointer-events-none cursor-pointer'

const viewBtn =
  'inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 sm:px-3 text-xs font-semibold text-white transition ' +
  'hover:bg-primary-dull focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 cursor-pointer'

const deleteBtn =
  'inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-red-200/80 bg-white text-red-600 transition ' +
  'hover:bg-red-50 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50 focus-visible:ring-offset-1 cursor-pointer'

const waBtn =
  'inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-emerald-200/80 bg-emerald-50/70 text-emerald-700 transition ' +
  'hover:bg-emerald-50 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 focus-visible:ring-offset-1 cursor-pointer'

const menuItemClass =
  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none cursor-pointer'

/**
 * Compact reservation row actions — View + WhatsApp + More + Delete.
 * Handlers are passed in; no business logic lives here.
 */
const BookingRowActions = ({
  t,
  onView,
  onEdit,
  onDownloadLicense,
  onDownloadId,
  onDownloadPassport,
  onWhatsApp,
  onPrint,
  onDelete,
}) => {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const rootRef = useRef(null)
  const moreBtnRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!open || !moreBtnRef.current) return undefined
    const place = () => {
      const rect = moreBtnRef.current.getBoundingClientRect()
      const menuWidth = 208
      const gap = 6
      let left = rect.right - menuWidth
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))
      let top = rect.bottom + gap
      const estimatedHeight = 280
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - gap)
      }
      setMenuPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      const inRoot = rootRef.current?.contains(e.target)
      const inMenu = menuRef.current?.contains(e.target)
      if (!inRoot && !inMenu) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const run = (fn) => (e) => {
    e.stopPropagation()
    setOpen(false)
    fn?.()
  }

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
          className="z-[80] w-52 overflow-hidden rounded-xl border border-borderColor bg-white py-1 shadow-lg shadow-black/10"
        >
          <button type="button" role="menuitem" className={menuItemClass} onClick={run(onEdit)}>
            <PencilIcon />
            <span>{t('admin.bookings.edit')}</span>
          </button>

          <div className="my-1 border-t border-borderColor" role="separator" />
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('admin.bookings.documents')}
          </p>
          <button type="button" role="menuitem" className={menuItemClass} onClick={run(onDownloadLicense)}>
            <LicenseIcon />
            <span>{t('admin.bookings.downloadLicense')}</span>
          </button>
          <button type="button" role="menuitem" className={menuItemClass} onClick={run(onDownloadId)}>
            <IdIcon />
            <span>{t('admin.bookings.downloadId')}</span>
          </button>
          <button type="button" role="menuitem" className={menuItemClass} onClick={run(onDownloadPassport)}>
            <PassportIcon />
            <span>{t('admin.bookings.downloadPassport')}</span>
          </button>

          <div className="my-1 border-t border-borderColor" role="separator" />
          <button type="button" role="menuitem" className={menuItemClass} onClick={run(onPrint)}>
            <PrintIcon />
            <span>{t('admin.bookings.print')}</span>
          </button>
        </div>,
        document.body,
      )
    : null

  return (
    <div
      ref={rootRef}
      className="inline-flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={viewBtn}
        onClick={run(onView)}
        title={t('admin.bookings.view')}
        aria-label={t('admin.bookings.view')}
      >
        <EyeIcon />
        <span className="hidden sm:inline">{t('admin.bookings.view')}</span>
      </button>

      <button
        type="button"
        className={waBtn}
        onClick={run(onWhatsApp)}
        title={t('admin.bookings.whatsapp')}
        aria-label={t('admin.bookings.whatsapp')}
      >
        <WhatsAppIcon />
      </button>

      <button
        ref={moreBtnRef}
        type="button"
        className={`${toolbarBtn} ${open ? 'border-primary/40 bg-primary/5 text-primary' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={t('admin.bookings.moreActions')}
        aria-label={t('admin.bookings.moreActions')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <MoreIcon />
      </button>

      {menu}

      <button
        type="button"
        className={deleteBtn}
        onClick={run(onDelete)}
        title={t('admin.bookings.delete')}
        aria-label={t('admin.bookings.delete')}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

export default BookingRowActions
