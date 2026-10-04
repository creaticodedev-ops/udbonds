import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ar } from './ar'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { getLocaleMeta, getNested, interpolate } from './locales'
import { LANG_CHANGE_EVENT, readStoredLocale, writeStoredLocale } from './localeSync'
import { saasArExtras, saasEsExtras, saasFrExtras } from './saasLocaleExtras'

const deepMerge = (target, source) => {
  if (source === undefined || source === null) return target
  if (Array.isArray(source)) return source
  if (typeof source !== 'object') return source
  const base = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
  const out = { ...base }
  for (const key of Object.keys(source)) {
    out[key] = deepMerge(base[key], source[key])
  }
  return out
}

const contactEsExtras = {
  demoKicker: 'Demo del producto',
  demoTitle: 'Descubra RSZ CAR en acción.',
  demoTitleBefore: 'Descubra RSZ CAR ',
  demoTitleEm: 'en acción.',
  demoLead:
    'Reserve una demostración personalizada. Mostramos reservas, flota, clientes y contratos — adaptados a cómo opera su agencia.',
  point1: 'Recorrido en vivo adaptado a sus flujos reales',
  point2: 'Respuestas según el tamaño de flota y su equipo',
  point3: 'Respuesta rápida por WhatsApp',
  stepsAria: 'Cómo funciona la demo',
  step1: 'Cuéntenos su agencia y qué quiere ver',
  step2: 'Le guiamos por RSZ CAR en directo',
  step3: 'Decida si una prueba o el despliegue encaja',
  formKickerDemo: 'Solicitud de demo',
  formTitleDemo: 'Solicite su demo',
  formLead: 'Indique cómo contactarle. Respondemos rápido.',
  formLeadDemo: 'Unos datos para preparar una demostración relevante.',
  sentManual: 'Su solicitud está lista. Le contactaremos en breve — o continúe por WhatsApp.',
  successKicker: 'Solicitud lista',
  successTitle: 'Gracias — le contactaremos en breve.',
  backHome: 'Volver al inicio',
  fleetPh: 'p. ej. 15 vehículos',
  messagePh: 'Cuéntenos brevemente qué necesita…',
  messagePhDemo: 'Háblenos de su agencia y su disponibilidad…',
  orTrial: '¿Prefiere probar primero?',
  seoDemoTitle: 'Solicitar una demo de RSZ CAR',
  seoDemoDescription: 'Reserve una demostración personalizada de RSZ CAR para su agencia de alquiler.',
  formKicker: 'Contacto',
  formTitle: 'Enviar un mensaje',
}

const contactArExtras = {
  demoKicker: 'عرض توضيحي للمنتج',
  demoTitle: 'اكتشف RSZ CAR عملياً.',
  demoTitleBefore: 'اكتشف RSZ CAR ',
  demoTitleEm: 'عملياً.',
  demoLead:
    'احجز عرضاً توضيحياً مخصصاً. نعرض الحجوزات والأسطول والعملاء والعقود — وفق طريقة عمل وكالتك.',
  point1: 'جولة مباشرة وفق تدفقات عملك الحقيقية',
  point2: 'إجابات حسب حجم الأسطول وفريقك',
  point3: 'رد سريع عبر واتساب',
  stepsAria: 'كيف يعمل العرض التوضيحي',
  step1: 'شاركنا وكالتك وما تريد رؤيته',
  step2: 'نرشدك في RSZ CAR مباشرة',
  step3: 'قرّر إن كانت تجربة أو إطلاق مناسبين',
  formKickerDemo: 'طلب عرض توضيحي',
  formTitleDemo: 'اطلب عرضك التوضيحي',
  formLead: 'أخبرنا كيف نتواصل معك. نرد بسرعة.',
  formLeadDemo: 'بعض التفاصيل لنجهّز عرضاً ملائماً.',
  sentManual: 'طلبك جاهز. سنتواصل قريباً — أو تابع عبر واتساب.',
  successKicker: 'الطلب جاهز',
  successTitle: 'شكراً — سنتواصل معك قريباً.',
  backHome: 'العودة إلى الصفحة الرئيسية',
  fleetPh: 'مثلاً 15 مركبة',
  messagePh: 'أخبرنا باختصار بما تحتاجه…',
  messagePhDemo: 'أخبرنا عن وكالتك ومواعيد تفرّغك…',
  orTrial: 'هل تفضّل التجربة أولاً؟',
  seoDemoTitle: 'طلب عرض توضيحي لـ RSZ CAR',
  seoDemoDescription: 'احجز عرضاً توضيحياً مخصصاً لـ RSZ CAR لوكالة تأجير السيارات.',
  formKicker: 'تواصل',
  formTitle: 'أرسل رسالة',
}

const esPatched = deepMerge(es, {
  cta: {
    demo: 'Solicitar una demo',
    register: 'Registrarse',
    whatsapp: 'Contactar por WhatsApp',
    whatsappShort: 'WhatsApp',
  },
  alts: {
    statistics: 'Estadísticas de vehículos RSZ CAR: ingresos y utilización',
  },
  saas: saasEsExtras,
  contact: contactEsExtras,
  signup: {
    moreOptional: 'Añadir ciudad y tamaño de flota (opcional)',
  },
})

const arPatched = deepMerge(ar, {
  cta: {
    demo: 'طلب عرض توضيحي',
    register: 'التسجيل',
    whatsapp: 'التواصل عبر واتساب',
    whatsappShort: 'واتساب',
  },
  alts: {
    statistics: 'إحصاءات مركبات RSZ CAR: الإيرادات والاستخدام',
  },
  saas: saasArExtras,
  contact: contactArExtras,
  signup: {
    moreOptional: 'إضافة المدينة وحجم الأسطول (اختياري)',
  },
})

const frPatched = deepMerge(fr, {
  saas: saasFrExtras,
})

const dictionaries = { en, fr: frPatched, es: esPatched, ar: arPatched }

const MarketingI18nContext = createContext(null)

export const MarketingI18nProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(readStoredLocale)
  const meta = getLocaleMeta(locale)

  const setLocale = (code) => {
    if (!dictionaries[code]) return
    setLocaleState(code)
    writeStoredLocale(code)
  }

  useEffect(() => {
    const onBridge = (event) => {
      const code = event?.detail?.code
      if (!dictionaries[code] || code === locale) return
      setLocaleState(code)
    }
    window.addEventListener(LANG_CHANGE_EVENT, onBridge)
    return () => window.removeEventListener(LANG_CHANGE_EVENT, onBridge)
  }, [locale])

  useEffect(() => {
    const html = document.documentElement
    const prevLang = html.lang
    const prevDir = html.getAttribute('dir') || 'ltr'
    html.lang = meta.htmlLang
    html.dir = meta.dir
    html.classList.toggle('mkt-rtl', meta.dir === 'rtl')
    return () => {
      html.lang = prevLang
      html.dir = prevDir
      html.classList.remove('mkt-rtl')
    }
  }, [meta.dir, meta.htmlLang])

  const value = useMemo(() => {
    const dict = dictionaries[locale] || en
    const lookup = (key) => {
      const local = getNested(dict, key)
      if (local !== undefined) return local
      return getNested(en, key)
    }
    const t = (key, vars = {}) => {
      const valueAt = lookup(key)
      if (typeof valueAt !== 'string') return ''
      return interpolate(valueAt, vars)
    }
    const ta = (key) => {
      const valueAt = lookup(key)
      return Array.isArray(valueAt) ? valueAt : []
    }
    return {
      locale,
      dir: meta.dir,
      isRtl: meta.dir === 'rtl',
      htmlLang: meta.htmlLang,
      ogLocale: meta.ogLocale,
      setLocale,
      t,
      ta,
    }
  }, [locale, meta.dir, meta.htmlLang, meta.ogLocale])

  return <MarketingI18nContext.Provider value={value}>{children}</MarketingI18nContext.Provider>
}

export const useMktI18n = () => {
  const ctx = useContext(MarketingI18nContext)
  if (!ctx) throw new Error('useMktI18n must be used within MarketingI18nProvider')
  return ctx
}

export default MarketingI18nProvider
