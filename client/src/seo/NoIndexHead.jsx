import SeoHead from './SeoHead'
import { PLATFORM_NAME } from '../constants/brand'

/** Apply noindex on private booking flows / unresolved storefronts. */
const NoIndexHead = ({ title = PLATFORM_NAME, description = 'Private area' }) => (
  <SeoHead
    title={title}
    description={description}
    path="/"
    noindex
    lang="fr"
  />
)

export default NoIndexHead
