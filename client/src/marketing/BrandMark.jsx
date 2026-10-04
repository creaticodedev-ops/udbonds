import { Link } from 'react-router-dom'
import { BRAND } from './config'
import { useMktI18n } from './i18n/MarketingI18n'
import logoWebp from './brand/rsz-car-logo.webp'
import logoPng from './brand/rsz-car-logo.png'
import logoDarkWebp from './brand/rsz-car-logo-on-dark.webp'
import logoDarkPng from './brand/rsz-car-logo-on-dark.png'

/**
 * variant:
 * - dark  → black/red mark for light surfaces (transparent, no box)
 * - light → white/red mark for dark surfaces (transparent, no box)
 */
export const BrandMark = ({ to = '/', className = '', variant = 'dark', size = 'nav' }) => {
  const { t } = useMktI18n()
  const onDark = variant === 'light'
  const webp = onDark ? logoDarkWebp : logoWebp
  const png = onDark ? logoDarkPng : logoPng

  return (
    <Link
      to={to}
      className={`mkt-mark mkt-mark-${variant} mkt-mark-${size} ${className}`.trim()}
      aria-label={t('nav.home', { brand: BRAND })}
    >
      <picture>
        <source type="image/webp" srcSet={webp} />
        <img
          src={png}
          alt={BRAND}
          width={800}
          height={132}
          decoding="async"
          draggable="false"
        />
      </picture>
    </Link>
  )
}

export default BrandMark
