import React, { useEffect, useMemo, useState } from 'react';
import Title from '../../components/owner/Title';
import ChannelBadge from '../../components/owner/ChannelBadge';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/apiError';

const views = ['month', 'week', 'day'];

const BookingCalendar = () => {
  const { axios } = useAppContext();
  const { t } = useI18n();
  const now = new Date();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const month = cursor.getMonth() + 1;
  const year = cursor.getFullYear();

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        // Fetch current + adjacent months for week/day spanning
        const months = view === 'month' ? [month] : [month === 1 ? 12 : month - 1, month, month === 12 ? 1 : month + 1];
        const yearsFor = months.map((m, i) => {
          if (view === 'month') return year;
          if (i === 0 && month === 1) return year - 1;
          if (i === 2 && month === 12) return year + 1;
          return year;
        });

        const responses = await Promise.all(
          [...new Set(months.map((m, i) => `${yearsFor[i]}-${m}`))].map(async (key) => {
            const [y, m] = key.split('-').map(Number);
            const { data } = await axios.get(`/api/bookings/owner/calendar?month=${m}&year=${y}`);
            return data.success ? data.bookings : [];
          }),
        );
        const merged = [];
        const seen = new Set();
        for (const list of responses) {
          for (const b of list) {
            if (!seen.has(b._id)) {
              seen.add(b._id);
              merged.push(b);
            }
          }
        }
        setBookings(merged);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [month, year, view, axios]);

  const shift = (delta) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + delta);
    else if (view === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const bookingsOnDay = (date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return bookings.filter((b) => {
      const start = new Date(b.pickupDate);
      const end = new Date(b.returnDate);
      return start <= dayEnd && end >= dayStart;
    });
  };

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - cursor.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const headerLabel = view === 'month'
    ? cursor.toLocaleString('default', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `Week of ${weekDays[0].toLocaleDateString()}`
      : cursor.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const statusColor = (status) => {
    if (status === 'confirmed') return 'bg-green-100 text-green-700';
    if (status === 'active') return 'bg-blue-100 text-blue-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'completed') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 flex-1 pb-10'>
      <Title title={t('admin.calendar.title')} subTitle={t('admin.calendar.subtitle')} />

      <div className='mt-6 rounded-xl border border-borderColor bg-white p-4 min-w-0'>
        <div className="flex flex-col gap-3 mb-4 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => shift(-1)} className="px-3 py-1.5 border rounded-lg cursor-pointer text-sm">{t('admin.calendar.prev')}</button>
            <button type="button" onClick={() => setCursor(new Date())} className="px-3 py-1.5 border rounded-lg cursor-pointer text-sm">{t('admin.calendar.today')}</button>
            <button type="button" onClick={() => shift(1)} className="px-3 py-1.5 border rounded-lg cursor-pointer text-sm">{t('admin.calendar.next')}</button>
          </div>
          <h2 className="font-semibold text-gray-800 text-base lg:text-lg text-center min-w-0">{headerLabel}</h2>
          <div className="flex gap-1 bg-gray-50 p-1 rounded-lg self-center lg:justify-self-end overflow-x-auto">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm rounded-md capitalize cursor-pointer whitespace-nowrap ${view === v ? 'bg-white shadow text-primary font-medium' : 'text-gray-500'}`}
              >
                {t(`admin.calendar.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">{t('admin.calendar.loading')}</p>
        ) : view === 'month' ? (
          <div className="max-lg:overflow-x-auto">
            <div className="max-lg:min-w-[560px]">
            <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center py-1 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-16 md:min-h-20 rounded-md bg-gray-50" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = new Date(year, month - 1, day);
                const dayBookings = bookingsOnDay(date);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={day}
                    className={`min-h-16 md:min-h-20 rounded-md border p-1.5 text-sm cursor-pointer hover:border-primary/40 ${isToday ? 'border-primary bg-primary/5' : 'border-gray-100'}`}
                    onClick={() => { setCursor(date); setView('day'); }}
                  >
                    <p className="font-medium text-gray-700 text-sm">{day}</p>
                    {dayBookings.slice(0, 2).map((b) => (
                      <p
                        key={b._id}
                        className={`mt-1 text-[10px] leading-tight truncate rounded px-1 ${statusColor(b.status)}`}
                        title={b.reservationId}
                        onClick={(e) => { e.stopPropagation(); setSelected(b); }}
                      >
                        {b.car?.brand} {b.car?.model}
                      </p>
                    ))}
                    {dayBookings.length > 2 && (
                      <p className="text-[10px] text-gray-400">+{dayBookings.length - 2} more</p>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {weekDays.map((date) => {
              const dayBookings = bookingsOnDay(date);
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div key={date.toISOString()} className={`rounded-lg border p-2 min-h-40 ${isToday ? 'border-primary bg-primary/5' : 'border-gray-100'}`}>
                  <button type="button" onClick={() => { setCursor(date); setView('day'); }} className="text-left w-full cursor-pointer">
                    <p className="text-xs text-gray-500">{date.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                    <p className="font-semibold text-gray-800">{date.getDate()}</p>
                  </button>
                  <div className="mt-2 space-y-1">
                    {dayBookings.map((b) => (
                      <button
                        key={b._id}
                        type="button"
                        onClick={() => setSelected(b)}
                        className={`w-full text-left text-[10px] rounded px-1.5 py-1 truncate cursor-pointer ${statusColor(b.status)}`}
                      >
                        {b.customerName || b.reservationId}
                      </button>
                    ))}
                    {!dayBookings.length && <p className="text-[10px] text-gray-300">—</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {bookingsOnDay(cursor).length === 0 && (
                <p className="text-sm text-gray-400 py-8 text-center">{t('admin.calendar.noDay')}</p>
              )}
              {bookingsOnDay(cursor).map((b) => (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => setSelected(b)}
                  className="w-full text-left rounded-lg border border-borderColor p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-800">{b.reservationId || t('admin.bookings.reservation')}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor(b.status)}`}>{b.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{b.customerName} · {b.car?.brand} {b.car?.model}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(b.pickupDate).toLocaleString()} → {new Date(b.returnDate).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800">{selected.reservationId}</h3>
            <ChannelBadge channel={selected.channel || 'online'} className="mt-2" />
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">{t('admin.bookings.customer')}:</span> {selected.customerName}</p>
              <p><span className="font-medium">{t('admin.bookings.vehicle')}:</span> {selected.car?.brand} {selected.car?.model}</p>
              <p><span className="font-medium">Pickup:</span> {new Date(selected.pickupDate).toLocaleString()}</p>
              <p><span className="font-medium">Return:</span> {new Date(selected.returnDate).toLocaleString()}</p>
              <p><span className="font-medium">{t('admin.bookings.status')}:</span> <span className="capitalize">{selected.status}</span></p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="mt-4 px-4 py-2 border rounded-lg text-sm cursor-pointer">{t('admin.calendar.close')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
