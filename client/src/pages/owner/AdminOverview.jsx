import React, { useEffect, useState } from 'react';
import Title from '../../components/owner/Title';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/apiError';

const AdminOverview = () => {
  const { axios, currency } = useAppContext();
  const { t } = useI18n();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const { data } = await axios.get('/api/owner/overview');
        if (data.success) {
          setOverview(data.overview);
          setError(null);
        } else {
          setError(data.message);
          toast.error(data.message);
        }
      } catch (err) {
        const msg = getErrorMessage(err);
        setError(msg);
        toast.error(msg);
      }
    };

    fetchOverview();
  }, [axios]);

  if (error && !overview) {
    return (
      <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 flex-1'>
        <Title title={t('admin.dashboard.title')} subTitle={t('admin.dashboard.subtitle')} />
        <p className='text-red-500 mt-6'>{error}</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 flex-1'>
        <Title title={t('admin.dashboard.title')} subTitle={t('admin.dashboard.subtitle')} />
        <p className='text-gray-500 mt-6'>{t('admin.common.loading')}</p>
      </div>
    );
  }

  return (
    <div className='px-4 py-8 md:px-8 lg:px-10 xl:px-12 md:py-10 flex-1 pb-10'>
      <Title title={t('admin.dashboard.title')} subTitle={t('admin.dashboard.subtitle')} />

      <div className='grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mt-6'>
        {[
          { label: t('admin.fleet.car'), value: overview.totalVehicles },
          { label: t('admin.menu.reservations'), value: overview.totalReservations },
          { label: t('admin.dashboard.available'), value: overview.availableVehicles },
          { label: t('admin.dashboard.onRent'), value: overview.rentedVehicles },
          { label: t('admin.menu.customers'), value: overview.totalCustomers },
          { label: t('admin.dashboard.monthlyRevenue'), value: `${currency}${overview.revenue}` },
        ].map((item) => (
          <div key={item.label} className='rounded-lg border border-borderColor p-4 bg-white'>
            <p className='text-sm text-gray-500'>{item.label}</p>
            <p className='text-2xl font-semibold text-gray-800'>{item.value}</p>
          </div>
        ))}
      </div>

      <div className='mt-8 rounded-lg border border-borderColor p-4 bg-white'>
        <h2 className='text-lg font-semibold text-gray-800'>{t('admin.menu.reservations')}</h2>
        <div className='mt-4 space-y-3'>
          {overview.recentReservations.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('admin.bookings.none')}</p>
          ) : overview.recentReservations.map((booking) => (
            <div key={booking._id} className='flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 gap-3'>
              <div className="min-w-0">
                <p className='font-medium text-gray-700 truncate'>{booking.customerName || t('admin.common.guest')}</p>
                <p className='text-sm text-gray-500 truncate'>{booking.car?.brand} {booking.car?.model}</p>
              </div>
              <span className='text-sm text-gray-500 capitalize shrink-0'>{booking.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
