import { CLIENTS } from '../config'
import { useMktI18n } from '../i18n/MarketingI18n'

export const SaasTrust = () => {
  const { t, ta } = useMktI18n()
  const chips = ta('saas.trustChips')

  return (
    <section className="saas-trust" aria-label={t('proof.label')}>
      <div className="mkt-wrap saas-trust-inner">
        <div>
          <p className="saas-trust-label">{t('proof.plate')}</p>
          <ul className="saas-trust-clients">
            {CLIENTS.map((client) => (
              <li key={client.name}>{client.name}</li>
            ))}
          </ul>
        </div>
        {chips.length ? (
          <ul className="saas-trust-chips">
            {chips.map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export default SaasTrust
