import React from 'react'

const ConfirmDialog = ({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, variant = 'danger' }) => {
  if (!isOpen) return null

  const confirmClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-primary hover:bg-primary-dull'

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/40">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full p-5 sm:p-6 border border-borderColor max-h-[90svh] overflow-y-auto overscroll-contain">
        <h3 className="text-lg font-semibold text-ink break-words">{title}</h3>
        <p className="mt-2 text-sm text-muted break-words">{message}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-4 py-2.5 text-sm border border-borderColor rounded-xl hover:bg-light cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-12 px-4 py-2.5 text-sm text-white rounded-xl cursor-pointer ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
