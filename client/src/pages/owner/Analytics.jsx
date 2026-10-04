import React, { useEffect, useState } from 'react';
import Title from '../../components/owner/Title';
import RevenueChart from '../../components/owner/RevenueChart';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/apiError';

const Analytics = () => {
  const { axios, currency } = useAppContext();
  const { t } = useI18n();
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get('/api/owner/analytics');
        if (data.success) setAnalytics(data.analytics);
        else toast.error(data.message);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [axios]);

  const chartData = tab === 'weekly'
    ? analytics?.weeklyTrend
    : tab === 'yearly'
      ? analytics?.yearlyTrend
      : analytics?.monthlyTrend;

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12">
      <Title title={t('admin.analytics.title')} subTitle={t('admin.analytics.subtitle')} />

      {loading ? (
        <p className="mt-8 text-gray-400">{t('admin.analytics.loading')}</p>
      ) : !analytics ? (
        <div className="mt-8">
          <p className="text-gray-500">{t('admin.shell.loadError')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-primary hover:underline"
          >
            {t('admin.shell.retry')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {[
              { label: t('admin.analytics.thisWeek'), value: analytics.weeklyRevenue },
              { label: t('admin.analytics.thisMonth'), value: analytics.monthlyRevenue },
              { label: t('admin.analytics.thisYear'), value: analytics.yearlyRevenue },
              { label: t('admin.analytics.allTime'), value: analytics.totalRevenue },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-borderColor bg-white p-5">
                <p className="text-xs text-gray-500 uppercase">{card.label}</p>
                <p className="text-2xl font-semibold text-primary mt-1">{currency}{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-5">
              <p className="text-xs text-sky-700 uppercase font-medium">{t('admin.analytics.onlineRevenue')}</p>
              <p className="text-xl font-semibold text-sky-900 mt-1">{currency}{analytics.onlineRevenue ?? 0}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-5">
              <p className="text-xs text-amber-800 uppercase font-medium">{t('admin.analytics.walkInRevenue')}</p>
              <p className="text-xl font-semibold text-amber-950 mt-1">{currency}{analytics.walkInRevenue ?? 0}</p>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-borderColor bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="font-semibold text-gray-800">{t('admin.analytics.incomeTrends')}</h2>
              <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
                {['weekly', 'monthly', 'yearly'].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setTab(period)}
                    className={`px-3 py-1.5 text-sm rounded-md capitalize cursor-pointer ${tab === period ? 'bg-white shadow text-primary font-medium' : 'text-gray-500'}`}
                  >
                    {t(`admin.analytics.${period}`)}
                  </button>
                ))}
              </div>
            </div>
            <RevenueChart data={chartData || []} currency={currency} height={220} />
          </div>

          <div className="mt-6 rounded-xl border border-borderColor bg-white p-5">
            <h2 className="font-semibold text-gray-800 mb-4">{t('admin.analytics.byStatus')}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {(analytics.byStatus || []).map((row) => (
                <div key={row._id} className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-500 capitalize">{row._id}</p>
                  <p className="text-lg font-semibold">{row.count}</p>
                  <p className="text-xs text-gray-400">{currency}{row.revenue || 0}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
