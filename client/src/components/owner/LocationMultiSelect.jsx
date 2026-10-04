import React, { useMemo } from 'react'

/**
 * Multi-select checklist for available cities, with Select All.
 */
const LocationMultiSelect = ({
  cities = [],
  selected = [],
  onChange,
  label,
  selectAllLabel = 'Select all',
  hint,
  required = false,
}) => {
  const selectedSet = useMemo(
    () => new Set(selected.map((c) => String(c).toLowerCase())),
    [selected]
  )
  const allSelected = cities.length > 0 && cities.every((c) => selectedSet.has(c.toLowerCase()))

  const toggleCity = (city) => {
    const key = city.toLowerCase()
    if (selectedSet.has(key)) {
      onChange(selected.filter((c) => c.toLowerCase() !== key))
    } else {
      onChange([...selected, city])
    }
  }

  const toggleAll = () => {
    onChange(allSelected ? [] : [...cities])
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between gap-2">
        <label>
          {label}
          {required ? ' *' : ''}
        </label>
        {cities.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            {selectAllLabel}
            {allSelected ? ' ✓' : ''}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      <div className="mt-2 rounded-md border border-borderColor bg-white max-h-48 overflow-y-auto divide-y divide-borderColor">
        {cities.length === 0 ? (
          <p className="px-3 py-3 text-xs text-gray-400">No pickup cities configured yet.</p>
        ) : (
          cities.map((city) => {
            const checked = selectedSet.has(city.toLowerCase())
            return (
              <label
                key={city}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 text-gray-700"
              >
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  checked={checked}
                  onChange={() => toggleCity(city)}
                />
                <span className="text-sm">{city}</span>
              </label>
            )
          })
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-500 mt-1.5">
          {selected.length} selected: {selected.join(', ')}
        </p>
      )}
    </div>
  )
}

export default LocationMultiSelect
