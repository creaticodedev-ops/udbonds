import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import { getErrorMessage } from '../../utils/apiError';

const NotificationBell = () => {
  const { axios } = useAppContext();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await axios.get('/api/owner/notifications');
      if (data.success) {
        setItems(data.notifications || []);
        setUnread(data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    try {
      await axios.post('/api/owner/notifications/read', { all: true });
      load();
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  };

  const markOne = async (id) => {
    try {
      await axios.post('/api/owner/notifications/read', { notificationId: id });
      load();
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="relative p-2 rounded-lg border border-borderColor hover:bg-gray-50 cursor-pointer"
        aria-label={t('admin.shell.notifications')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-md:fixed max-md:inset-x-3 max-md:right-auto max-md:mt-0 max-md:top-[57px] max-md:w-auto rounded-xl border border-borderColor bg-white shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">{t('admin.shell.notifications')}</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs text-primary cursor-pointer whitespace-nowrap">{t('admin.shell.markAllRead')}</button>
            )}
          </div>
          <div className="max-h-[min(20rem,60svh)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">{t('admin.shell.noNotifications')}</p>
            ) : items.map((n) => (
              <Link
                key={n._id}
                to={n.link || '/owner/manage-bookings'}
                onClick={() => { markOne(n._id); setOpen(false); }}
                className={`block px-3 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.isRead ? 'bg-primary/5' : ''}`}
              >
                <p className="text-sm font-medium text-gray-800 break-words">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
