import React from 'react'

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClass} border-2 border-primary/20 border-t-primary rounded-full animate-spin`} />
    </div>
  )
}

export default LoadingSpinner
