import React from 'react'

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-600',
  active: 'bg-blue-100 text-blue-600',
  completed: 'bg-purple-100 text-purple-600',
  cancelled: 'bg-red-100 text-red-600',
  paid: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
  refunded: 'bg-gray-100 text-gray-600',
}

const StatusBadge = ({ status, className = '' }) => {
  const style = statusStyles[status?.toLowerCase()] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style} ${className}`}>
      {status}
    </span>
  )
}

export default StatusBadge
