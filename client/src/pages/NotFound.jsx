import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

const NotFound = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center page-pad text-center py-16">
      <p className="text-5xl sm:text-6xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl sm:text-2xl font-semibold text-gray-800">Page not found</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-500 max-w-md">The page you are looking for does not exist or has been moved.</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
        <Link to="/" className="px-5 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-dull text-center">
          {t('nav.home')}
        </Link>
        <Link to="/cars" className="px-5 py-2.5 rounded-lg border border-borderColor text-gray-700 hover:bg-gray-50 text-center">
          {t('nav.cars')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
