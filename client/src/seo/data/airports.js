/**
 * Enrichment only for real airports. Pages are published solely when an active
 * PickupLocation with locationType=airport exists in the live system.
 */
export const AIRPORT_ENRICHMENT = {
  cmn: {
    slug: 'casablanca-cmn',
    iata: 'CMN',
    name: 'Aéroport Mohammed V Casablanca',
    citySlug: 'casablanca',
    cityName: 'Casablanca',
    title: 'Location voiture aéroport Casablanca (CMN)',
    description:
      'Location de voiture à l’aéroport Mohammed V (Casablanca) avec HDN Car. Prise en charge aéroport, flotte récente, réservation en ligne.',
    h1: 'Location de voiture à l’aéroport de Casablanca (CMN)',
    intro:
      'L’aéroport Mohammed V (CMN) est la principale porte d’entrée internationale du Maroc. HDN Car propose une prise en charge sur ce point de retrait lorsqu’il est actif dans notre système de réservation — idéal pour démarrer vers Casablanca, Rabat, El Jadida ou Marrakech.',
    sections: [
      {
        heading: 'Après l’atterrissage',
        body: 'Prévoyez le temps des formalités et des bagages. Une fois votre réservation confirmée, notre équipe vous indique le point de rendez-vous exact pour la remise des clés. Ayez permis et pièce d’identité prêts.',
      },
      {
        heading: 'Itinéraires fréquents depuis CMN',
        body: 'Casablanca centre (via A3/periphériques), Rabat (~1h), El Jadida, et liaison autoroutière vers Marrakech. Un GPS ou une app hors-ligne aide aux sorties d’aéroport.',
      },
    ],
    faqs: [
      {
        question: 'La location à l’aéroport CMN est-elle disponible 7j/7 ?',
        answer:
          'Les créneaux dépendent de vos dates et de la disponibilité. Indiquez votre numéro de vol lors de la réservation pour mieux coordonner l’accueil.',
      },
      {
        question: 'Puis-je rendre le véhicule dans une autre ville ?',
        answer:
          'Oui selon les lieux de retour actifs (ville ou autre aéroport). Les frais éventuels sont indiqués avant confirmation.',
      },
    ],
  },
  rak: {
    slug: 'marrakech-rak',
    iata: 'RAK',
    name: 'Aéroport Marrakech Menara',
    citySlug: 'marrakech',
    cityName: 'Marrakech',
    title: 'Location voiture aéroport Marrakech (RAK)',
    description:
      'Location de voiture à l’aéroport Marrakech Menara (RAK) avec HDN Car. Démarrez votre séjour vers la médina, l’Atlas ou Essaouira.',
    h1: 'Location de voiture à l’aéroport de Marrakech (RAK)',
    intro:
      'Marrakech Menara (RAK) accueille une grande partie du trafic touristique. Lorsque ce point aéroport est actif chez HDN Car, vous pouvez réserver une prise en charge sur place pour enchaîner vers la ville, l’Ourika, Ouarzazate ou Essaouira.',
    sections: [
      {
        heading: 'Conseils pratiques RAK',
        body: 'La sortie aéroport est courte vers la ville. Évitez d’entrer en voiture dans les ruelles de la médina : garez-vous en parking périphérique. Pour l’Atlas le jour même, un SUV ou une compacte récente est recommandé.',
      },
      {
        heading: 'Vers Essaouira ou l’Atlas',
        body: 'Comptez environ 2h30–3h vers Essaouira selon le trafic. Vers les vallées de l’Atlas, partez tôt et anticipez les routes sinueuses.',
      },
    ],
    faqs: [
      {
        question: 'Puis-je louer à RAK et rendre à Casablanca ?',
        answer:
          'Oui si les deux lieux sont actifs pour vos dates. Sélectionnez le retour souhaité lors de la réservation.',
      },
    ],
  },
}

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** Match a live PickupLocation to enrichment + slug. */
export const resolveAirportSeo = (location) => {
  if (!location || location.locationType !== 'airport') return null
  const blob = normalize(`${location.name || ''} ${location.city || ''} ${location.address || ''}`)

  let key = null
  if (blob.includes('mohammed v') || blob.includes('casablanca') || blob.includes('cmn')) key = 'cmn'
  else if (blob.includes('menara') || blob.includes('marrakech') || blob.includes('marrakesh') || blob.includes('rak')) key = 'rak'

  const enrich = key ? AIRPORT_ENRICHMENT[key] : null
  const slug =
    enrich?.slug ||
    normalize(location.city || location.name || 'aeroport')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  return {
    slug,
    iata: enrich?.iata || '',
    locationId: location._id,
    locationName: location.name,
    city: location.city,
    address: location.address,
    deliveryFee: location.deliveryFee,
    title: enrich?.title || `Location voiture ${location.name}`,
    description:
      enrich?.description ||
      `Location de voiture à ${location.name} (${location.city || 'Maroc'}) avec HDN Car.`,
    h1: enrich?.h1 || `Location de voiture — ${location.name}`,
    intro:
      enrich?.intro ||
      `Point de prise en charge aéroport actif : ${location.name}. Réservez en ligne avec HDN Car selon vos dates de vol.`,
    sections: enrich?.sections || [
      {
        heading: 'Prise en charge aéroport',
        body: 'Ce lieu est un point de retrait aéroport réel dans notre système. Les instructions exactes de remise des clés vous sont communiquées après confirmation.',
      },
    ],
    faqs: enrich?.faqs || [
      {
        question: 'Comment confirmer la disponibilité aéroport ?',
        answer:
          'Choisissez ce lieu dans la recherche de véhicules ou contactez HDN Car avec votre heure d’arrivée.',
      },
    ],
    citySlug: enrich?.citySlug || normalize(location.city || '').replace(/[^a-z0-9]+/g, '-'),
  }
}

export const airportsFromLocations = (locations = []) =>
  locations
    .filter((l) => l?.isActive !== false && l?.locationType === 'airport')
    .map(resolveAirportSeo)
    .filter(Boolean)
