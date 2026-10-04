import React, { useEffect, useState } from 'react';
import Title from '../../components/owner/Title';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/apiError';

const Reports = () => {
  const { axios, currency } = useAppContext();
  const { t } = useI18n();
  const [analytics, setAnalytics] = useState(null);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    axios.get('/api/owner/analytics')
      .then(({ data }) => { if (data.success) setAnalytics(data.analytics); })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [axios]);

  const download = async (type) => {
    setExporting(type);
    try {
      const response = await axios.get(`/api/owner/reports/export?type=${type}`, { responseType: 'blob' });
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const json = JSON.parse(text);
        toast.error(json.message || 'Export failed');
        return;
      }
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-report-${Date.now()}.csv`;
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting('');
    }
  };

  const printPdf = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      toast.error('Allow pop-ups to print PDF');
      return;
    }
    w.document.write(`
      <html><head><title>Agency Report</title>
      <style>body{font-family:Arial;padding:32px}h1{margin:0 0 8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #e5e7eb;padding:16px;border-radius:8px}</style>
      </head><body>
      <h1>Car Rental Agency Report</h1>
      <p>Generated ${new Date().toLocaleString()}</p>
      <div class="grid">
        <div class="card"><b>Weekly revenue</b><br/>${currency}${analytics?.weeklyRevenue || 0}</div>
        <div class="card"><b>Monthly revenue</b><br/>${currency}${analytics?.monthlyRevenue || 0}</div>
        <div class="card"><b>Yearly revenue</b><br/>${currency}${analytics?.yearlyRevenue || 0}</div>
        <div class="card"><b>Total revenue</b><br/>${currency}${analytics?.totalRevenue || 0}</div>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12">
      <Title title={t('admin.reports.title')} subTitle={t('admin.reports.subtitle')} />

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('admin.reports.weekly'), value: analytics?.weeklyRevenue },
          { label: t('admin.reports.monthly'), value: analytics?.monthlyRevenue },
          { label: t('admin.reports.yearly'), value: analytics?.yearlyRevenue },
          { label: t('admin.reports.allTime'), value: analytics?.totalRevenue },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-borderColor bg-white p-5">
            <p className="text-xs text-gray-500">{c.label} {t('admin.reports.revenue')}</p>
            <p className="text-xl font-semibold text-primary mt-1">{currency}{c.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { type: 'revenue', title: 'Reservations report', desc: 'All bookings with amounts, status, and dates' },
          { type: 'customers', title: 'Customers report', desc: 'CRM profiles, ratings, VIP/blacklist, spending' },
          { type: 'fleet', title: 'Fleet & compliance', desc: 'Mileage, service, insurance, registration' },
        ].map((card) => (
          <div key={card.type} className="rounded-xl border border-borderColor bg-white p-5">
            <h3 className="font-semibold text-gray-800">{card.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{card.desc}</p>
            <button
              type="button"
              disabled={exporting === card.type}
              onClick={() => download(card.type)}
              className="mt-4 px-4 py-2 text-sm bg-primary text-white rounded-lg cursor-pointer disabled:opacity-60"
            >
              {exporting === card.type ? t('admin.reports.exporting') : t('admin.reports.exportCsv')}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-borderColor bg-white p-5">
        <h3 className="font-semibold text-gray-800">{t('admin.reports.pdfTitle')}</h3>
        <p className="text-sm text-gray-500 mt-1">{t('admin.reports.pdfHint')}</p>
        <button type="button" onClick={printPdf} className="mt-4 px-4 py-2 text-sm border rounded-lg cursor-pointer hover:bg-gray-50">
          {t('admin.reports.printPdf')}
        </button>
      </div>
    </div>
  );
};

export default Reports;
