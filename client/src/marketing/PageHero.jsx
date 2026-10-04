export const PageHero = ({ kicker, title, children, actions }) => (
  <header className="mkt-page-hero">
    <div className="mkt-page-hero-haze" aria-hidden />
    <div className="mkt-wrap mkt-page-hero-copy">
      {kicker ? <p className="mkt-kicker">{kicker}</p> : null}
      <h1 className="mkt-h1">{title}</h1>
      {children}
      {actions ? <div className="mkt-actions">{actions}</div> : null}
    </div>
  </header>
)

export default PageHero
