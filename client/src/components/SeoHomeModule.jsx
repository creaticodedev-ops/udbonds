import { Link } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import { getPublishedCities } from '../seo/data/cities'
import { getCityImage } from '../seo/data/cityImages'
import { SEO_CATEGORIES } from '../seo/data/categories'
import { assets } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
import { booking } from './ui/bookingUi'

const CATEGORY_FALLBACKS = {
  suv: assets.banner_car_image,
  economique: assets.car_image1,
  compacte: assets.car_image2,
  familiale: assets.car_image3,
  automatique: null,
}

/** Pick a real fleet photo for an SEO category when the catalog is loaded. */
const resolveCategoryImage = (category, cars = []) => {
  if (!category) return assets.car_image1
  if (category.filterType === 'transmission') {
    const auto = cars.find((c) => /auto/i.test(String(c.transmission || '')))
    if (auto?.image || auto?.images?.[0]) return auto.image || auto.images[0]
    return null
  }
  const wanted = String(category.filterValue || '').toLowerCase()
  const match = cars.find((c) => String(c.category || '').toLowerCase() === wanted)
  if (match?.image || match?.images?.[0]) return match.image || match.images[0]
  return CATEGORY_FALLBACKS[category.slug] || assets.car_image1
}

const BookIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5A2.25 2.25 0 0119.5 5.25v13.5A2.25 2.25 0 0117.25 21H6.75a2.25 2.25 0 01-2.25-2.25V5.25z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5" />
  </svg>
)

const BulbIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75a5.25 5.25 0 00-3 9.55V16.5h6v-3.2A5.25 5.25 0 0012 3.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 19.5h4.5M10.5 21.75h3" />
  </svg>
)

const PinIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-10a6 6 0 10-12 0c0 4.9 6 10 6 10z" />
    <circle cx="12" cy="11" r="2.1" />
  </svg>
)

const CarGlyph = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 15.5h17M5 15.5l1.2-5.2A2 2 0 018.15 8.5h7.7a2 2 0 011.95 1.8l1.2 5.2" />
    <circle cx="7.5" cy="16.75" r="1.35" />
    <circle cx="16.5" cy="16.75" r="1.35" />
  </svg>
)

const GearIcon = () => (
  <svg className="h-10 w-10 text-primary/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 13.2a1.5 1.5 0 010-2.4l1.1-.7a.8.8 0 00.3-1.1l-1.2-2.1a.8.8 0 00-1-.3l-1.2.5a7.5 7.5 0 00-2.1-1.2l-.2-1.3a.8.8 0 00-.8-.7h-2.4a.8.8 0 00-.8.7l-.2 1.3a7.5 7.5 0 00-2.1 1.2l-1.2-.5a.8.8 0 00-1 .3L3.2 9a.8.8 0 00.3 1.1l1.1.7a1.5 1.5 0 010 2.4l-1.1.7a.8.8 0 00-.3 1.1l1.2 2.1a.8.8 0 001 .3l1.2-.5a7.5 7.5 0 002.1 1.2l.2 1.3a.8.8 0 00.8.7h2.4a.8.8 0 00.8-.7l.2-1.3a7.5 7.5 0 002.1-1.2l1.2.5a.8.8 0 001-.3l1.2-2.1a.8.8 0 00-.3-1.1l-1.1-.7z" />
  </svg>
)

const ShieldIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5l7 2.5v5.3c0 4.2-2.9 7.9-7 9.2-4.1-1.3-7-5-7-9.2V6L12 3.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.2l1.7 1.7 3.5-3.6" />
  </svg>
)

const ChatIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 18.5l-1.2 3.2 3.5-1.1A8.8 8.8 0 0020.5 12 8.5 8.5 0 0012 3.5 8.5 8.5 0 003.5 12c0 2.4.95 4.55 2.5 6.15" />
  </svg>
)

const PriceIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" />
  </svg>
)

const FleetIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 15.5h17M5 15.5l1.2-5.2A2 2 0 018.15 8.5h7.7a2 2 0 011.95 1.8l1.2 5.2" />
    <circle cx="7.5" cy="16.75" r="1.35" />
    <circle cx="16.5" cy="16.75" r="1.35" />
  </svg>
)

/** Truthful trust points already communicated on the site (no invented guarantees). */
const TRUST_ITEMS = [
  {
    title: 'Réservation simple',
    body: 'Réservez en ligne en quelques minutes — sans carte bancaire pour démarrer.',
    Icon: ShieldIcon,
  },
  {
    title: 'Support WhatsApp',
    body: 'Une équipe locale réactive pour vous accompagner avant et pendant le voyage.',
    Icon: ChatIcon,
  },
  {
    title: 'Tarifs clairs',
    body: 'Prix affichés avant confirmation — pas de frais cachés sur le parcours.',
    Icon: PriceIcon,
  },
  {
    title: 'Flotte soignée',
    body: 'Véhicules entretenus, choisis pour le confort et la fiabilité sur les routes du Maroc.',
    Icon: FleetIcon,
  },
]

const MoroccoMotif = ({ side = 'left' }) => (
  <svg
    className={`pointer-events-none absolute top-8 hidden h-44 w-28 text-primary/[0.07] lg:block ${
      side === 'left' ? 'left-2 xl:left-6' : 'right-2 xl:right-6 scale-x-[-1]'
    }`}
    viewBox="0 0 80 160"
    fill="none"
    aria-hidden
  >
    <path d="M40 8 L40 148" stroke="currentColor" strokeWidth="1.2" />
    <path d="M40 28c-10 0-18 8-18 20v18c0 8 5 14 12 17v8h12v-8c7-3 12-9 12-17V48c0-12-8-20-18-20z" stroke="currentColor" strokeWidth="1.2" />
    <path d="M22 78h36M26 92h28M30 106h20" stroke="currentColor" strokeWidth="1" />
    <path d="M12 148h56" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
  }),
}

/**
 * Homepage SEO bridge into the Morocco pillar — premium layout, real SEO data & fleet images.
 * Routes / sitemap / JSON-LD remain unchanged.
 */
const SeoHomeModule = () => {
  const { cars } = useAppContext()
  const cities = getPublishedCities().slice(0, 8)
  const categories = SEO_CATEGORIES

  return (
    <section className="relative overflow-x-clip border-t border-borderColor/60 bg-gradient-to-b from-light via-sand/35 to-light">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(165, 22, 36,0.06),_transparent_60%)]" aria-hidden />
      <MoroccoMotif side="left" />
      <MoroccoMotif side="right" />

      <div className="page-shell page-pad relative py-14 sm:py-16 md:py-20">
        {/* Header */}
        <Motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.35 }}
          className="mx-auto max-w-3xl text-center"
        >
          <Motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-3">
            <span className="hidden h-px w-10 bg-primary/30 sm:block" aria-hidden />
            <span className={`${booking.eyebrow} inline-flex items-center gap-2`}>
              <CarGlyph />
              HDN Car — Guides & voyages
            </span>
            <span className="hidden h-px w-10 bg-primary/30 sm:block" aria-hidden />
          </Motion.div>

          <Motion.h2 variants={fadeUp} custom={1} className="mt-4 font-display text-[1.85rem] font-medium leading-[1.15] text-ink sm:text-4xl md:text-[2.65rem]">
            Location de voiture au Maroc
          </Motion.h2>
          <Motion.p variants={fadeUp} custom={2} className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-[15px]">
            Découvrez nos guides villes, aéroports actifs et catégories de véhicules — puis réservez en ligne en quelques clics avec HDN Car.
          </Motion.p>

          <Motion.div variants={fadeUp} custom={3} className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/location-voiture-maroc"
              className={`${booking.btnPrimary} w-full sm:w-auto shadow-[0_14px_32px_-18px_rgba(165, 22, 36,0.65)]`}
            >
              <BookIcon />
              Guide location voiture Maroc
            </Link>
            <Link to="/guide" className={`${booking.btnSecondary} w-full sm:w-auto`}>
              <BulbIcon />
              Conseils pratiques
            </Link>
          </Motion.div>
        </Motion.div>

        {/* Cities + Categories */}
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-2 lg:gap-6">
          {/* Cities card */}
          <Motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="flex min-w-0 flex-col rounded-[1.5rem] border border-borderColor/70 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(22,18,16,0.45)] sm:p-6"
          >
            <header className="mb-4 flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_10px_24px_-14px_rgba(165, 22, 36,0.8)]">
                <PinIcon />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
                  Villes populaires
                </h3>
                <p className="mt-0.5 text-xs text-muted sm:text-[13px]">
                  Choisissez votre ville de départ.
                </p>
              </div>
            </header>

            <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
              {cities.map((city) => {
                const photo = getCityImage(city.slug)
                return (
                  <li key={city.slug} className="min-w-0">
                    <Link
                      to={`/location-voiture/${city.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-borderColor/70 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_36px_-28px_rgba(22,18,16,0.45)]"
                    >
                      <div className="relative aspect-[5/3.4] overflow-hidden bg-sand">
                        {photo ? (
                          <img
                            src={photo.src}
                            alt={photo.alt}
                            width={480}
                            height={326}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 ease-out group-hover:scale-[1.06]"
                          />
                        ) : null}
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/20 to-ink/10 transition duration-500 group-hover:from-ink/45 group-hover:via-ink/15"
                          aria-hidden
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-ink/35 text-white shadow-sm backdrop-blur-[2px] transition duration-300 group-hover:scale-105 group-hover:bg-ink/45">
                            <PinIcon />
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1.5 px-2.5 py-2.5">
                        <span className="truncate text-[13px] font-semibold text-ink sm:text-sm">
                          {city.name}
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-muted transition duration-300 group-hover:translate-x-0.5 group-hover:text-primary"
                        >
                          →
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-auto flex justify-center pt-5">
              <Link
                to="/location-voiture-maroc"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-primary-dull"
              >
                Voir toutes les villes
                <span aria-hidden>→</span>
              </Link>
            </div>
          </Motion.section>

          {/* Categories card */}
          <Motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.06 }}
            className="flex min-w-0 flex-col rounded-[1.5rem] border border-borderColor/70 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(22,18,16,0.45)] sm:p-6"
          >
            <header className="mb-4 flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_10px_24px_-14px_rgba(165, 22, 36,0.8)]">
                <CarGlyph />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
                  Catégories de véhicules
                </h3>
                <p className="mt-0.5 text-xs text-muted sm:text-[13px]">
                  Trouvez le véhicule adapté à vos besoins.
                </p>
              </div>
            </header>

            <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
              {categories.map((cat) => {
                const image = resolveCategoryImage(cat, cars)
                const isAuto = cat.filterType === 'transmission'
                return (
                  <li key={cat.slug} className={isAuto ? 'col-span-2 md:col-span-1' : 'min-w-0'}>
                    <Link
                      to={`/cars/${cat.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-borderColor/70 bg-light/30 transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_16px_36px_-28px_rgba(22,18,16,0.45)]"
                    >
                      <div className="relative flex aspect-[5/3.2] items-center justify-center overflow-hidden bg-gradient-to-b from-sand/50 to-white">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            width={320}
                            height={200}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain object-center p-2 transition duration-500 group-hover:scale-[1.04] sm:p-3"
                            onError={(e) => {
                              e.currentTarget.src = assets.car_image1
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-primary">
                            <GearIcon />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1.5 border-t border-borderColor/50 px-2.5 py-2.5">
                        <span className="truncate text-[13px] font-semibold text-ink sm:text-sm">
                          {cat.name}
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-muted transition duration-300 group-hover:translate-x-0.5 group-hover:text-primary"
                        >
                          →
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-auto flex justify-center pt-5">
              <Link
                to="/cars"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-primary-dull"
              >
                Voir toutes les catégories
                <span aria-hidden>→</span>
              </Link>
            </div>
          </Motion.section>
        </div>

        {/* Trust bar — only claims already present in the product experience */}
        <Motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mx-auto mt-6 max-w-6xl rounded-[1.35rem] border border-borderColor/60 bg-white/80 px-4 py-5 shadow-[0_16px_40px_-36px_rgba(22,18,16,0.35)] backdrop-blur-sm sm:mt-8 sm:px-6 sm:py-6"
        >
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {TRUST_ITEMS.map(({ title, body, Icon }) => (
              <li key={title} className="flex gap-3 min-w-0">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary ring-1 ring-primary/10">
                  <Icon />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-[13px]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Motion.div>
      </div>
    </section>
  )
}

export default SeoHomeModule
