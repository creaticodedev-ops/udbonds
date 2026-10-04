import SeoHead from '../../seo/SeoHead'
import MarketingLayout from '../../marketing/MarketingLayout'
import { PageHero } from '../../marketing/PageHero'
import { BRAND, CONTACT_EMAIL } from '../../marketing/config'
import { useMktI18n } from '../../marketing/i18n/MarketingI18n'

const LegalInner = ({ path, titleKey, descKey, kickerKey, headingKey, bodyKeys, questionKey, fallbackKey }) => {
  const { t, htmlLang, ogLocale, dir } = useMktI18n()

  return (
    <>
      <SeoHead
        title={t(titleKey)}
        description={t(descKey)}
        path={path}
        lang={htmlLang}
        dir={dir}
        locale={ogLocale}
        siteName={BRAND}
      />
      <PageHero kicker={t(kickerKey)} title={t(headingKey)} />
      <section className="mkt-page-body">
        <div className="mkt-wrap mkt-page-prose">
          {bodyKeys.map((key) => (
            <p key={key} className="mkt-lead">
              {t(key)}
            </p>
          ))}
          {CONTACT_EMAIL ? (
            <p className="mkt-lead">
              {t(questionKey)} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          ) : fallbackKey ? (
            <p className="mkt-lead">{t(fallbackKey)}</p>
          ) : null}
        </div>
      </section>
    </>
  )
}

const PrivacyInner = () => (
  <LegalInner
    path="/privacy"
    titleKey="seo.privacyTitle"
    descKey="seo.privacyDescription"
    kickerKey="privacy.kicker"
    headingKey="privacy.title"
    bodyKeys={['privacy.p1', 'privacy.p2', 'privacy.p3', 'privacy.p4']}
    questionKey="privacy.questions"
    fallbackKey="privacy.fallback"
  />
)

const TermsInner = () => (
  <LegalInner
    path="/terms"
    titleKey="seo.termsTitle"
    descKey="seo.termsDescription"
    kickerKey="terms.kicker"
    headingKey="terms.title"
    bodyKeys={['terms.p1', 'terms.p2', 'terms.p3', 'terms.p4']}
    questionKey="terms.questions"
  />
)

export const PrivacyPage = () => (
  <MarketingLayout>
    <PrivacyInner />
  </MarketingLayout>
)

export const TermsPage = () => (
  <MarketingLayout>
    <TermsInner />
  </MarketingLayout>
)

export default PrivacyPage
