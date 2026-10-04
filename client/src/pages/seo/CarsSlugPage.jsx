import { useParams } from 'react-router-dom'
import { CATEGORY_SLUGS } from '../../seo/data/categories'
import CategoryPage from './CategoryPage'
import VehicleSeoPage from './VehicleSeoPage'

/** Resolves /cars/:slug to category hub or vehicle SEO page. */
const CarsSlugPage = () => {
  const { slug } = useParams()
  const key = String(slug || '').toLowerCase()
  if (CATEGORY_SLUGS.has(key)) return <CategoryPage />
  return <VehicleSeoPage slug={key} />
}

export default CarsSlugPage
