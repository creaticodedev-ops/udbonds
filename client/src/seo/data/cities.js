/**
 * City SEO registry. Only `published: true` pages are routed/sitemapped.
 * Non-HQ cities describe delivery/coverage honestly — no invented counters.
 */
const city = (data) => data

export const SEO_CITIES = [
  city({
    slug: 'casablanca',
    name: 'Casablanca',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: ['casablanca-cmn'],
    title: 'Location voiture Casablanca — aéroport et ville',
    description:
      'Location de voiture à Casablanca avec HDN Car. Départ aéroport CMN ou livraison selon disponibilité. Idéal business et road trips vers Rabat ou Marrakech.',
    h1: 'Location de voiture à Casablanca',
    intro:
      'Casablanca concentre affaires, Corniche et liaisons autoroutières. HDN Car vous permet de démarrer depuis l’aéroport Mohammed V (CMN) lorsqu’il est actif, ou d’organiser une prise en charge selon les lieux disponibles — sans inventer d’agence fantôme en centre-ville.',
    sections: [
      {
        heading: 'Se déplacer à Casa',
        body: 'Privilégiez périphérique et axes structurants ; le centre historique et certains parkings saturent aux heures de pointe. Une boîte automatique réduit la fatigue dans les embouteillages.',
      },
      {
        heading: 'Escales fréquentes',
        body: 'Rabat (A3), El Jadida, Safi (notre base), et Marrakech via A7. Calculez péages et carburant sur les longs trajets.',
      },
    ],
    faqs: [
      {
        question: 'Puis-je louer directement à l’aéroport CMN ?',
        answer:
          'Oui lorsque le point aéroport Casablanca est actif. Voir la page Location voiture aéroport Casablanca.',
      },
    ],
    relatedCategories: ['automatique', 'economique', 'suv'],
  }),
  city({
    slug: 'marrakech',
    name: 'Marrakech',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: ['marrakech-rak'],
    title: 'Location voiture Marrakech — médina, Atlas, Essaouira',
    description:
      'Location de voiture à Marrakech avec HDN Car. Aéroport Menara (RAK), départs vers l’Atlas, Ouarzazate ou Essaouira.',
    h1: 'Location de voiture à Marrakech',
    intro:
      'Marrakech est le hub touristique du sud. Louez pour éviter les transferts répétés vers Ourika, Ouarzazate ou Essaouira. La prise en charge aéroport RAK est proposée lorsqu’elle est active dans notre système.',
    sections: [
      {
        heading: 'Médina et parking',
        body: 'Ne pénétrez pas les ruelles en voiture. Utilisez parkings Guéliz / périphérie et continuez à pied ou en taxi pour la place Jemaa el-Fna.',
      },
      {
        heading: 'Vers la montagne',
        body: 'Cols et routes sinueuses : un SUV ou une compacte récente est plus confortable qu’une micro-citadine chargée.',
      },
    ],
    faqs: [
      {
        question: 'Combien de temps jusqu’à Essaouira ?',
        answer: 'Environ 2h30–3h selon trafic et arrêts. Route bitumée adaptée aux compactes.',
      },
    ],
    relatedCategories: ['suv', 'compacte', 'automatique'],
  }),
  city({
    slug: 'agadir',
    name: 'Agadir',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: [],
    title: 'Location voiture Agadir — côte et Anti-Atlas',
    description:
      'Location de voiture pour Agadir et la région : beach resorts, Taghazout, routes vers Tiznit. Couverture HDN Car selon disponibilité et livraison.',
    h1: 'Location de voiture à Agadir',
    intro:
      'Agadir attire soleil et surf. HDN Car n’affiche pas de comptoir aéroport Agadir tant qu’il n’est pas un point actif : nous organisons la location / livraison selon les options réellement ouvertes à vos dates.',
    sections: [
      {
        heading: 'Autour d’Agadir',
        body: 'Taghazout, Paradise Valley (accès selon véhicule), et liaisons vers Marrakech. Vérifiez l’état des pistes avant de quitter le bitume.',
      },
    ],
    faqs: [
      {
        question: 'Avez-vous un desk à l’aéroport d’Agadir ?',
        answer:
          'Pas de page aéroport Agadir tant que ce lieu n’est pas actif dans notre système. Contactez-nous pour une solution de livraison honnête.',
      },
    ],
    relatedCategories: ['suv', 'economique'],
  }),
  city({
    slug: 'rabat',
    name: 'Rabat',
    published: true,
    hasLocalOffice: true,
    nearbyAirportSlugs: ['casablanca-cmn'],
    title: 'Location voiture Rabat — capitale et côte',
    description:
      'Location de voiture à Rabat avec HDN Car. Idéal pour administrations, Salé, et liaisons Casablanca–Tanger.',
    h1: 'Location de voiture à Rabat',
    intro:
      'Capitale administrative, Rabat se parcourt bien en voiture hors des zones piétonnes historiques. Un point bureau peut être disponible selon les lieux actifs (ex. centre / Salé) — vérifiez la liste au moment de la réservation.',
    sections: [
      {
        heading: 'Vers le nord et Casa',
        body: 'Autoroute vers Tanger ou Casablanca fluide hors pointes. Combinez avec une journée à Salé ou Kenitra.',
      },
    ],
    faqs: [
      {
        question: 'Mieux vaut-il récupérer à CMN ou à Rabat ?',
        answer:
          'CMN si vous atterrissez à Casablanca ; Rabat si vous êtes déjà sur place. Comparez les frais de lieu affichés.',
      },
    ],
    relatedCategories: ['compacte', 'automatique', 'familiale'],
  }),
  city({
    slug: 'tanger',
    name: 'Tanger',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: [],
    title: 'Location voiture Tanger — détroit et nord du Maroc',
    description:
      'Location de voiture pour Tanger et le nord : médina, Cap Spartel, route vers Tétouan et Chefchaouen. Service HDN Car selon disponibilité.',
    h1: 'Location de voiture à Tanger',
    intro:
      'Tanger ouvre le Maroc sur l’Europe. Pour rejoindre Chefchaouen ou longer la côte, une voiture évite les correspondances. Nous couvrons la demande via livraison / points actifs — sans desk inventé.',
    sections: [
      {
        heading: 'Road trip nord',
        body: 'Tanger–Tétouan–Chefchaouen est un classique. Routes parfois étroites : conduisez prudemment, surtout de nuit.',
      },
    ],
    faqs: [],
    relatedCategories: ['compacte', 'suv'],
  }),
  city({
    slug: 'fes',
    name: 'Fès',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: [],
    title: 'Location voiture Fès — médina et Moyen Atlas',
    description:
      'Louez une voiture pour Fès et les environs : visite de la médina à pied, puis mobilité vers Meknès, Ifrane ou la côte.',
    h1: 'Location de voiture à Fès',
    intro:
      'La médina de Fès se visite sans voiture. Louez pour les étapes inter-villes (Meknès, Rabat, Chefchaouen) et garez-vous en dehors des ruelles.',
    sections: [
      {
        heading: 'Parking et accès',
        body: 'Utilisez parkings périphériques. Un GPS aide à éviter les voies interdites autour de la vieille ville.',
      },
    ],
    faqs: [],
    relatedCategories: ['compacte', 'economique'],
  }),
  city({
    slug: 'essaouira',
    name: 'Essaouira',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: ['marrakech-rak'],
    title: 'Location voiture Essaouira — depuis Marrakech ou la côte',
    description:
      'Location de voiture pour Essaouira : vent, médina et route depuis Marrakech. Conseils HDN Car pour un trajet serein.',
    h1: 'Location de voiture à Essaouira',
    intro:
      'Beaucoup de voyageurs louent à Marrakech (RAK) puis rejoignent Essaouira. Une compacte suffit ; prévoyez le vent et les parkings près des remparts.',
    sections: [
      {
        heading: 'Depuis Marrakech',
        body: 'Route touristique fréquentée. Partez tôt le matin en haute saison pour éviter la chaleur et le trafic local.',
      },
    ],
    faqs: [],
    relatedCategories: ['compacte', 'economique'],
  }),
  city({
    slug: 'safi',
    name: 'Safi',
    published: true,
    hasLocalOffice: true,
    nearbyAirportSlugs: [],
    title: 'Location voiture Safi — siège HDN Car',
    description:
      'Location de voiture à Safi, siège de HDN Car. Potiers, côte atlantique, liaisons vers El Jadida, Marrakech et Casablanca.',
    h1: 'Location de voiture à Safi',
    intro:
      'Safi est notre base : AB Ibn Battouta, quartier Azib Derai. Idéal si vous démarrez ou terminez sur la côte atlantique centrale, avec un contact local direct.',
    sections: [
      {
        heading: 'Autour de Safi',
        body: 'El Jadida, Oualidia, et remontée vers Casablanca. Notre équipe connaît les délais réels de préparation des véhicules.',
      },
    ],
    faqs: [
      {
        question: 'Puis-je retirer le véhicule au siège ?',
        answer:
          'Oui selon créneau convenu. Contactez HDN Car pour caler l’heure après votre réservation en ligne.',
      },
    ],
    relatedCategories: ['economique', 'compacte', 'suv'],
  }),
  city({
    slug: 'meknes',
    name: 'Meknès',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: [],
    title: 'Location voiture Meknès',
    description:
      'Location de voiture pour Meknès et le Moyen Atlas : Volubilis, Ifrane, Fès. Couverture HDN Car selon disponibilité.',
    h1: 'Location de voiture à Meknès',
    intro:
      'Meknès est une excellente base pour Volubilis et Ifrane. Louez pour enchaîner les sites sans dépendre des grands taxis.',
    sections: [
      {
        heading: 'Circuit suggéré',
        body: 'Meknès–Volubilis–Moulay Idriss en journée, puis Ifrane si vous visez la fraîcheur du Moyen Atlas.',
      },
    ],
    faqs: [],
    relatedCategories: ['compacte', 'suv'],
  }),
  city({
    slug: 'ouarzazate',
    name: 'Ouarzazate',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: [],
    title: 'Location voiture Ouarzazate — portes du désert',
    description:
      'Location de voiture vers Ouarzazate et la route des kasbahs. Préférez un SUV pour le confort sur les étapes depuis Marrakech.',
    h1: 'Location de voiture à Ouarzazate',
    intro:
      'Ouarzazate ouvre sur Aït Ben Haddou et les vallées du sud. La plupart des clients louent à Marrakech puis rejoignent la ville — choisissez un véhicule à l’aise sur les cols.',
    sections: [
      {
        heading: 'Conseil véhicule',
        body: 'SUV recommandé pour bagages et routes de montagne. Évitez de vous engager sur des pistes non couvertes par votre contrat.',
      },
    ],
    faqs: [],
    relatedCategories: ['suv'],
  }),
  city({
    slug: 'chefchaouen',
    name: 'Chefchaouen',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: [],
    title: 'Location voiture Chefchaouen',
    description:
      'Monter à Chefchaouen en voiture depuis Tanger ou Fès : conseils parking et routes avec HDN Car.',
    h1: 'Location de voiture à Chefchaouen',
    intro:
      'La ville bleue se visite à pied. La voiture sert surtout à arriver et repartir : garez-vous en bas / parkings indiqués, ne forcez pas les ruelles.',
    sections: [
      {
        heading: 'Accès',
        body: 'Depuis Tanger ou Fès, routes sinueuses. Conduite de jour recommandée si vous n’êtes pas habitué.',
      },
    ],
    faqs: [],
    relatedCategories: ['compacte', 'suv'],
  }),
  city({
    slug: 'el-jadida',
    name: 'El Jadida',
    published: true,
    hasLocalOffice: false,
    nearbyAirportSlugs: ['casablanca-cmn'],
    title: 'Location voiture El Jadida',
    description:
      'Location de voiture pour El Jadida et la côte : Cité Portugaise, liaisons Casablanca et Safi.',
    h1: 'Location de voiture à El Jadida',
    intro:
      'Entre Casablanca et Safi, El Jadida convient aux week-ends côtiers. Une économique ou compacte suffit pour la ville et la Corniche.',
    sections: [
      {
        heading: 'Liaisons',
        body: 'A3/routes côtières vers Casa ; descente vers Safi pour rejoindre notre base HDN Car.',
      },
    ],
    faqs: [],
    relatedCategories: ['economique', 'compacte'],
  }),
  // Unpublished stubs — scalable later without code changes
  city({ slug: 'tetouan', name: 'Tétouan', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'nador', name: 'Nador', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'kenitra', name: 'Kénitra', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'mohammedia', name: 'Mohammedia', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'ifrane', name: 'Ifrane', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'al-hoceima', name: 'Al Hoceima', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'dakhla', name: 'Dakhla', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'laayoune', name: 'Laâyoune', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'oujda', name: 'Oujda', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
  city({ slug: 'sale', name: 'Salé', published: false, title: '', description: '', h1: '', intro: '', sections: [], faqs: [], relatedCategories: [] }),
]

export const getPublishedCities = () => SEO_CITIES.filter((c) => c.published)

export const getCityBySlug = (slug) => {
  const cityData = SEO_CITIES.find((c) => c.slug === String(slug || '').toLowerCase())
  return cityData?.published ? cityData : null
}
