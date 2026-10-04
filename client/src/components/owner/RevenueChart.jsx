import React from 'react';

/** Lightweight CSS bar chart — no chart library required */
const RevenueChart = ({ data = [], currency = '', height = 180 }) => {
  const max = Math.max(1, ...data.map((d) => d.amount || 0));

  if (!data.length) {
    return <p className="text-sm text-gray-400 py-10 text-center">No revenue data yet</p>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: data.length > 10 ? `${data.length * 2.5}rem` : undefined }}>
        <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
          {data.map((item) => {
            const pct = Math.max(4, Math.round(((item.amount || 0) / max) * 100));
            return (
              <div key={item.key} className="flex-1 flex flex-col items-center justify-end h-full group min-w-[1.5rem]">
                <span className="text-[10px] text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {currency}{item.amount}
                </span>
                <div
                  className="w-full max-w-10 rounded-t-md bg-primary/80 hover:bg-primary transition-all"
                  style={{ height: `${pct}%` }}
                  title={`${item.label}: ${currency}${item.amount}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 sm:gap-2 mt-2">
          {data.map((item) => (
            <div key={`l-${item.key}`} className="flex-1 text-center min-w-[1.5rem]">
              <span className="text-[10px] text-gray-400 truncate block">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;
