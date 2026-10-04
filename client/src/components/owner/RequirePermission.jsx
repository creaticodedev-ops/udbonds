import React from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'

/**
 * Route-level permission gate for owner pages.
 * Empty permissions[] on the user = full access.
 */
const RequirePermission = ({ permission, children }) => {
  const { hasPermission } = useAppContext()
  const { t } = useI18n()

  if (hasPermission(permission)) return children

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 min-w-0">
      <h1 className="text-xl font-semibold text-gray-800">{t('admin.shell.noAccessTitle')}</h1>
      <p className="mt-2 text-sm text-gray-500 max-w-md">{t('admin.shell.noAccessBody')}</p>
      <Link to="/owner" className="inline-block mt-6 text-sm text-primary hover:underline">
        {t('admin.shell.backDashboard')}
      </Link>
    </div>
  )
}

export default RequirePermission
