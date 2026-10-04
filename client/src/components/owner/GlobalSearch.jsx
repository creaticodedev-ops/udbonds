import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import { getErrorMessage } from '../../utils/apiError';

const GlobalSearch = () => {
  const { axios } = useAppContext();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/owner/search?q=${encodeURIComponent(q.trim())}`);
        if (data.success) {
          setResults(data.results);
          setOpen(true);
        }
      } catch (error) {
        console.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, axios]);

  const go = (path) => {
    setOpen(false);
    setQ('');
    navigate(path);
  };

  const hasResults = results && (
    results.bookings?.length || results.cars?.length || results.customers?.length
  );

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (hasResults) setOpen(true); }}
        placeholder={t('admin.shell.searchPlaceholder')}
        className="w-full border border-borderColor rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary bg-white"
      />
      {open && (
        <div className="absolute left-0 mt-2 w-full min-w-[20rem] max-w-[28rem] rounded-xl border border-borderColor bg-white shadow-xl z-50 max-h-96 overflow-y-auto">
          {loading && <p className="p-3 text-xs text-gray-400">{t('admin.shell.searching')}</p>}
          {!loading && !hasResults && q.length >= 2 && (
            <p className="p-3 text-xs text-gray-400">{t('admin.shell.noResults')}</p>
          )}
          {results?.bookings?.length > 0 && (
            <div className="p-2">
              <p className="px-2 text-[10px] uppercase text-gray-400 font-medium">{t('admin.menu.reservations')}</p>
              {results.bookings.map((b) => (
                <button key={b._id} type="button" onClick={() => go('/owner/manage-bookings')} className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 text-sm cursor-pointer">
                  <span className="font-medium text-primary">{b.reservationId || 'RES'}</span>
                  <span className="text-gray-600"> · {b.customerName}</span>
                  <p className="text-xs text-gray-400">{b.car?.brand} {b.car?.model}</p>
                </button>
              ))}
            </div>
          )}
          {results?.cars?.length > 0 && (
            <div className="p-2 border-t">
              <p className="px-2 text-[10px] uppercase text-gray-400 font-medium">{t('admin.menu.fleet')}</p>
              {results.cars.map((c) => (
                <button key={c._id} type="button" onClick={() => go(`/owner/edit-car/${c._id}`)} className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 text-sm cursor-pointer">
                  {c.brand} {c.model}
                  <span className="text-xs text-gray-400"> · {c.licensePlate || c.location}</span>
                </button>
              ))}
            </div>
          )}
          {results?.customers?.length > 0 && (
            <div className="p-2 border-t">
              <p className="px-2 text-[10px] uppercase text-gray-400 font-medium">{t('admin.menu.customers')}</p>
              {results.customers.map((c) => (
                <button key={c._id} type="button" onClick={() => go('/owner/customers')} className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 text-sm cursor-pointer">
                  {c.name}
                  <p className="text-xs text-gray-400">{c.email} · {c.status}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
