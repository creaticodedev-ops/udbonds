import React from 'react'

/** WhatsApp guest reservations are treated as Online in the admin UI. */
const isOnlineChannel = (channel) => {
  const value = String(channel || 'online').trim().toLowerCase()
  return value !== 'walk_in' && value !== 'walk-in' && value !== 'walkin'
}

/** Online / Walk-in badge — WhatsApp reservations count as Online */
const ChannelBadge = ({ channel, className = '' }) => {
  const online = isOnlineChannel(channel)
  const styles = online
    ? 'bg-sky-100 text-sky-800 border border-sky-200'
    : 'bg-amber-100 text-amber-800 border border-amber-200'
  const label = online ? 'Online' : 'Walk-in'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${styles} ${className}`}
    >
      {label}
    </span>
  )
}

export default ChannelBadge
