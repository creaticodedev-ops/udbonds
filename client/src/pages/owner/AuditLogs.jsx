import React, { useEffect, useState } from 'react';
import Title from '../../components/owner/Title';
import { useAppContext } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/apiError';

const AuditLogs = () => {
  const { axios } = useAppContext();
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/owner/audit-logs?page=${page}&limit=30`);
        if (data.success) {
          setLogs(data.logs);
          setPagination(data.pagination);
        } else toast.error(data.message);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, axios]);

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12">
      <Title title={t('admin.audit.title')} subTitle={t('admin.audit.subtitle')} />

      <div className="mt-6 rounded-xl border border-borderColor bg-white overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400">{t('admin.audit.loading')}</p>
        ) : logs.length === 0 ? (
          <p className="p-6 text-gray-400">{t('admin.audit.none')}</p>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm text-left max-lg:min-w-[640px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-3">{t('admin.audit.when')}</th>
                  <th className="p-3">{t('admin.audit.action')}</th>
                  <th className="p-3">{t('admin.audit.entity')}</th>
                  <th className="p-3">{t('admin.audit.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-t border-gray-100">
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium text-primary text-xs">{log.action}</td>
                    <td className="p-3 text-xs">{log.entityType} {log.entityId ? `· ${String(log.entityId).slice(-8)}` : ''}</td>
                    <td className="p-3 text-gray-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40 cursor-pointer">{t('admin.common.previous')}</button>
            <span>{t('admin.bookings.pageOf', { page: pagination.page, total: pagination.totalPages })}</span>
            <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40 cursor-pointer">{t('admin.common.next')}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
