import React, { useEffect, useState } from 'react';
import Title from '../../components/owner/Title';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/apiError';

const statusStyles = {
  new: 'bg-blue-100 text-blue-700',
  regular: 'bg-gray-100 text-gray-700',
  vip: 'bg-amber-100 text-amber-700',
  blacklisted: 'bg-red-100 text-red-700',
};

const Stars = ({ value = 0, onChange, size = 'text-lg' }) => (
  <div className={`flex gap-0.5 ${size}`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange?.(n)}
        className={`${onChange ? 'cursor-pointer' : 'cursor-default'} ${n <= Math.round(value) ? 'text-amber-400' : 'text-gray-300'}`}
      >
        ★
      </button>
    ))}
  </div>
);

const emptyFilters = {
  search: '',
  status: '',
  city: '',
  minRating: '',
  minBookings: '',
  minSpent: '',
  sortBy: 'lastBookingAt',
};

const Customers = () => {
  const { axios, currency } = useAppContext();
  const { t } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => { if (v) params.set(k, v); });
      const { data } = await axios.get(`/api/owner/crm/customers?${params}`);
      if (data.success) setCustomers(data.customers);
      else toast.error(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [applied]);

  const openDetail = async (customer) => {
    setSelected(customer);
    setDetail(null);
    setNote('');
    setRating(5);
    try {
      const { data } = await axios.get(`/api/owner/crm/customers/${encodeURIComponent(customer.email)}`);
      if (data.success) setDetail(data);
      else toast.error(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitRating = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data } = await axios.post('/api/owner/crm/rate', {
        email: selected.email,
        rating,
        note: note || undefined,
      });
      if (data.success) {
        toast.success('Customer rated (admin only)');
        setNote('');
        openDetail(selected);
        fetchCustomers();
      } else toast.error(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async () => {
    if (!selected || !note.trim()) return;
    setSaving(true);
    try {
      const { data } = await axios.post('/api/owner/crm/note', { email: selected.email, note });
      if (data.success) {
        toast.success('Private note saved');
        setNote('');
        openDetail(selected);
      } else toast.error(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    if (!selected) return;
    let blacklistReason = '';
    if (status === 'blacklisted') {
      blacklistReason = window.prompt('Reason for blacklist (internal only):') || '';
    }
    try {
      const { data } = await axios.post('/api/owner/crm/status', {
        email: selected.email,
        status,
        blacklistReason,
      });
      if (data.success) {
        toast.success(`Marked as ${status}`);
        openDetail(selected);
        fetchCustomers();
      } else toast.error(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const inputClass = 'border border-borderColor rounded-md px-3 py-2 text-sm w-full outline-none focus:border-primary';

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12 min-w-0">
      <Title
        title={t('admin.customers.title')}
        subTitle={t('admin.customers.subtitle')}
      />

      <form
        onSubmit={(e) => { e.preventDefault(); setApplied({ ...filters }); }}
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-borderColor bg-white p-3 sm:p-4"
      >
        <input className={inputClass} placeholder={t('admin.customers.search')} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">{t('admin.customers.allStatuses')}</option>
          <option value="new">New</option>
          <option value="regular">{t('admin.customers.regular')}</option>
          <option value="vip">{t('admin.customers.vip')}</option>
          <option value="blacklisted">{t('admin.customers.blacklist')}</option>
        </select>
        <input className={inputClass} placeholder={t('admin.customers.city')} value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
        <select className={inputClass} value={filters.minRating} onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}>
          <option value="">{t('admin.customers.minRating')}</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
          <option value="5">5</option>
        </select>
        <input type="number" min="0" className={inputClass} placeholder={t('admin.customers.minBookings')} value={filters.minBookings} onChange={(e) => setFilters({ ...filters, minBookings: e.target.value })} />
        <input type="number" min="0" className={inputClass} placeholder={t('admin.customers.minSpending')} value={filters.minSpent} onChange={(e) => setFilters({ ...filters, minSpent: e.target.value })} />
        <select className={inputClass} value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}>
          <option value="lastBookingAt">Sort: Last booking</option>
          <option value="totalSpent">Sort: Spending</option>
          <option value="totalReservations">Sort: Bookings</option>
          <option value="rating">Sort: Rating</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="flex flex-col sm:flex-row gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm cursor-pointer">{t('admin.customers.apply')}</button>
          <button type="button" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); }} className="px-4 py-2 border rounded-lg text-sm cursor-pointer">{t('admin.customers.clear')}</button>
        </div>
      </form>

      <div className="mt-6 grid xl:grid-cols-[1.2fr_0.9fr] gap-6">
        <div className="rounded-xl border border-borderColor bg-white overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-sm text-left max-lg:min-w-[720px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-3">{t('admin.bookings.customer')}</th>
                  <th className="p-3">{t('admin.customers.status')}</th>
                  <th className="p-3">{t('admin.customers.rating')}</th>
                  <th className="p-3">{t('admin.customers.bookings')}</th>
                  <th className="p-3">{t('admin.customers.spent')}</th>
                  <th className="p-3">{t('admin.customers.lastBooking')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="p-6 text-center text-gray-400">{t('admin.customers.loading')}</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan="6" className="p-6 text-center text-gray-400">{t('admin.customers.none')}</td></tr>
                ) : customers.map((c) => (
                  <tr key={c._id} className="border-t border-gray-100 hover:bg-gray-50/80 cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="p-3">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                      <p className="text-xs text-gray-400">{c.phone}{c.city ? ` · ${c.city}` : ''}</p>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${statusStyles[c.status] || statusStyles.regular}`}>{c.status}</span>
                    </td>
                    <td className="p-3">
                      <Stars value={c.rating || 0} />
                      <p className="text-[10px] text-gray-400">{c.ratingCount || 0} ratings</p>
                    </td>
                    <td className="p-3">
                      {c.totalReservations}
                      <p className="text-[10px] text-red-400">{t('admin.customers.cancelled', { count: c.cancelledReservations || 0 })}</p>
                    </td>
                    <td className="p-3">{currency}{c.totalSpent || 0}</td>
                    <td className="p-3 text-xs">{c.lastBookingAt ? new Date(c.lastBookingAt).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-borderColor bg-white p-5 h-max xl:sticky xl:top-24 min-w-0">
          {!selected ? (
            <p className="text-gray-400 text-sm py-8 text-center">{t('admin.customers.selectHint')}</p>
          ) : !detail ? (
            <p className="text-gray-400 text-sm">{t('admin.common.loading')}</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{detail.customer.name}</h2>
                  <p className="text-sm text-gray-500">{detail.customer.email}</p>
                  <p className="text-xs text-gray-400">{detail.customer.phone}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${statusStyles[detail.customer.status]}`}>{detail.customer.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-400">Reservations</p><p className="font-semibold">{detail.customer.totalReservations}</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-400">Spent</p><p className="font-semibold">{currency}{detail.customer.totalSpent}</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-400">Cancellations</p><p className="font-semibold">{detail.customer.cancelledReservations}</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-400">Completed</p><p className="font-semibold">{detail.customer.completedReservations}</p></div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-1">Average rating (admin only)</p>
                <Stars value={detail.customer.rating || 0} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setStatus('vip')} className="px-3 py-1.5 text-xs rounded-lg bg-amber-50 text-amber-700 cursor-pointer">{t('admin.customers.vip')}</button>
                <button type="button" onClick={() => setStatus('regular')} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-700 cursor-pointer">{t('admin.customers.regular')}</button>
                <button type="button" onClick={() => setStatus('blacklisted')} className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-700 cursor-pointer">{t('admin.customers.blacklist')}</button>
              </div>
              {detail.customer.blacklistReason && (
                <p className="mt-2 text-xs text-red-600">Blacklist reason: {detail.customer.blacklistReason}</p>
              )}

              <div className="mt-5 border-t border-borderColor pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('admin.customers.rateCustomer')}</p>
                <Stars value={rating} onChange={setRating} size="text-2xl" />
                <textarea
                  className={`${inputClass} mt-2`}
                  rows="2"
                  placeholder='Private note e.g. "Excellent customer", "Late return", "Vehicle returned dirty"'
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button type="button" disabled={saving} onClick={submitRating} className="px-3 py-2 text-xs bg-primary text-white rounded-lg cursor-pointer disabled:opacity-60">{t('admin.customers.saveRating')}</button>
                  <button type="button" disabled={saving || !note.trim()} onClick={submitNote} className="px-3 py-2 text-xs border rounded-lg cursor-pointer disabled:opacity-60">{t('admin.customers.noteOnly')}</button>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('admin.customers.internalNotes')}</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(detail.customer.internalNotes || []).slice().reverse().map((n) => (
                    <div key={n._id || n.createdAt} className="text-xs rounded-lg bg-gray-50 p-2">
                      {n.rating && <Stars value={n.rating} size="text-sm" />}
                      <p className="text-gray-700 mt-0.5">{n.text}</p>
                      <p className="text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                    </div>
                  ))}
                  {!(detail.customer.internalNotes || []).length && <p className="text-xs text-gray-400">No notes yet</p>}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('admin.customers.bookingHistory')}</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(detail.bookings || []).map((b) => (
                    <div key={b._id} className="text-xs border-b border-gray-50 pb-2">
                      <p className="font-medium">{b.reservationId} · {b.car?.brand} {b.car?.model}</p>
                      <p className="text-gray-500 capitalize">{b.status} · {currency}{b.price} · {new Date(b.pickupDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Customers;
