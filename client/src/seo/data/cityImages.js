/**
 * Landmark photography for published SEO city cards.
 *
 * Sources: Wikimedia Commons (CC BY / CC BY-SA). Attribution required when redistributing.
 * Thumbs are 960px for consistent card crops (object-fit: cover).
 *
 * Visual content only — does not affect SEO routes, sitemap, or booking logic.
 */

/**
 * @typedef {{
 *   src: string,
 *   alt: string,
 *   landmark: string,
 *   credit: string,
 *   license: string,
 *   commonsFile: string,
 * }} CityImage
 */

/** @type {Record<string, CityImage>} */
export const CITY_IMAGES = {
  casablanca: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Hassan_II_Mosque_Plaza.jpg/960px-Hassan_II_Mosque_Plaza.jpg',
    alt: 'Mosquée Hassan II, Casablanca',
    landmark: 'Mosquée Hassan II',
    credit: 'FuriousYogi',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Hassan_II_Mosque_Plaza.jpg',
  },
  marrakech: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Koutoubia_minaret_from_the_city.JPG/960px-Koutoubia_minaret_from_the_city.JPG',
    alt: 'Minaret de la Koutoubia, Marrakech',
    landmark: 'Koutoubia',
    credit: 'Schorle',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Koutoubia_minaret_from_the_city.JPG',
  },
  agadir: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Agadir_beach_2016.jpg/960px-Agadir_beach_2016.jpg',
    alt: 'Plage d’Agadir',
    landmark: 'Plage d’Agadir',
    credit: 'Moroccan73',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Agadir_beach_2016.jpg',
  },
  rabat: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Kasbah_of_the_Udayas.jpg/960px-Kasbah_of_the_Udayas.jpg',
    alt: 'Kasbah des Oudayas, Rabat',
    landmark: 'Kasbah des Oudayas',
    credit: 'Dieglop',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Kasbah_of_the_Udayas.jpg',
  },
  tanger: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Phare_Cap_Spartel_%2CTangier_lighthouse.jpg/960px-Phare_Cap_Spartel_%2CTangier_lighthouse.jpg',
    alt: 'Phare du Cap Spartel, Tanger',
    landmark: 'Cap Spartel',
    credit: 'Ahmed.magdy',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Phare_Cap_Spartel_,Tangier_lighthouse.jpg',
  },
  fes: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Bab_Bou_Jeloud.jpg/960px-Bab_Bou_Jeloud.jpg',
    alt: 'Bab Bou Jeloud, Fès',
    landmark: 'Bab Bou Jeloud',
    credit: 'Casual Builder',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Bab_Bou_Jeloud.jpg',
  },
  essaouira: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Essaouira_fishing_harbour_%28Morocco%29_%283177873560%29.jpg/960px-Essaouira_fishing_harbour_%28Morocco%29_%283177873560%29.jpg',
    alt: 'Port de pêche d’Essaouira',
    landmark: 'Port d’Essaouira',
    credit: 'Ahron de Leeuw',
    license: 'CC BY 2.0',
    commonsFile: 'Essaouira_fishing_harbour_(Morocco)_(3177873560).jpg',
  },
  safi: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Safi_medina%28js%29.jpg/960px-Safi_medina%28js%29.jpg',
    alt: 'Médina de Safi',
    landmark: 'Médina de Safi',
    credit: 'Jerzy Strzelecki',
    license: 'CC BY 3.0',
    commonsFile: 'Safi_medina(js).jpg',
  },
  meknes: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Bab_Mansour_Meknes_2018_1.jpg/960px-Bab_Mansour_Meknes_2018_1.jpg',
    alt: 'Bab Mansour, Meknès',
    landmark: 'Bab Mansour',
    credit: 'Steven Lek',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Bab_Mansour_Meknes_2018_1.jpg',
  },
  ouarzazate: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/A%C3%AFtBenhaddou_Morocco_2.jpg/960px-A%C3%AFtBenhaddou_Morocco_2.jpg',
    alt: 'Ksar d’Aït Benhaddou, près d’Ouarzazate',
    landmark: 'Aït Benhaddou',
    credit: 'cliff williams',
    license: 'CC BY-SA 2.0',
    commonsFile: 'AïtBenhaddou_Morocco_2.jpg',
  },
  chefchaouen: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Chefchaouen_Morocco.jpg/960px-Chefchaouen_Morocco.jpg',
    alt: 'Rues bleues de Chefchaouen',
    landmark: 'Médina de Chefchaouen',
    credit: 'Chafiliass',
    license: 'CC BY-SA 4.0',
    commonsFile: 'Chefchaouen_Morocco.jpg',
  },
  'el-jadida': {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Portuguese_City_in_El_Jadida.jpg/960px-The_Portuguese_City_in_El_Jadida.jpg',
    alt: 'Cité portugaise d’El Jadida',
    landmark: 'Cité portugaise',
    credit: 'El Mehdi Imehda',
    license: 'CC BY-SA 4.0',
    commonsFile: 'The_Portuguese_City_in_El_Jadida.jpg',
  },
}

/** @returns {CityImage | null} */
export const getCityImage = (slug) => CITY_IMAGES[String(slug || '').toLowerCase()] || null

export default CITY_IMAGES
