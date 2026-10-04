import React from 'react'

const DataTable = ({ columns, data, sortBy, sortOrder, onSort, loading, emptyMessage = 'No data found' }) => {
  const handleSort = (key) => {
    if (!key || !onSort) return
    if (sortBy === key) {
      onSort(key, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(key, 'desc')
    }
  }

  const SortIcon = ({ columnKey }) => {
    if (!columnKey) return null
    if (sortBy !== columnKey) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-primary ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="w-full rounded-md overflow-hidden border border-borderColor bg-white">
      <div className="table-scroll">
        <table className="w-full border-collapse text-left text-sm text-gray-600 max-lg:min-w-[720px]">
          <thead className="text-gray-500 bg-gray-50">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`p-3 font-medium whitespace-nowrap ${col.className || ''} ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  onClick={() => col.sortable && handleSort(col.sortKey || col.key)}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortable && <SortIcon columnKey={col.sortKey || col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row._id || index} className="border-t border-borderColor hover:bg-gray-50/50">
                  {columns.map(col => (
                    <td key={col.key} className={`p-3 ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
