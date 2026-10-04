import React from 'react'

const Loader = ({ label }) => {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-4" role="status" aria-live="polite">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-sand" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
      </div>
      {label ? <p className="text-sm text-muted">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  )
}

export default Loader
