import React, { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import toast from 'react-hot-toast'
import axios from 'axios'
import { resolveApiBaseUrl } from '../utils/apiBase'
import SignaturePad from '../components/SignaturePad'
import { useI18n } from '../i18n/I18nContext'
import { useAppContext } from '../context/AppContext'
import { getErrorMessage } from '../utils/apiError'
import Loader from '../components/Loader'
import DocumentGenerationOverlay from '../components/DocumentGenerationOverlay'
import { useDocumentGeneration } from '../hooks/useDocumentGeneration'
import {
  FormField,
  SectionCard,
  formInputOnLightClass,
} from '../components/forms/PremiumFormUI'
import NoIndexHead from '../seo/NoIndexHead'

const STEPS = ['documents', 'signature', 'done']

/** Guest completion must not reuse the owner Bearer token */
const guestApi = axios.create({
  baseURL: resolveApiBaseUrl(),
})

const Field = FormField

const StepRail = ({ steps, current, labels, doneFlags }) => (
  <ol className="grid grid-cols-3 gap-2 sm:gap-4">
    {steps.map((key, i) => {
      const active = current === key
      const done = doneFlags[i]
      return (
        <li
          key={key}
          className={`relative rounded-2xl border px-3 py-3 sm:px-4 transition ${
            active ? 'border-primary bg-primary/5 shadow-sm' : done ? 'border-emerald-200 bg-emerald-50/60' : 'border-borderColor bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-emerald-600 text-white' : active ? 'bg-ink text-white' : 'bg-sand text-muted'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`text-xs sm:text-sm font-medium leading-tight ${active ? 'text-ink' : 'text-muted'}`}>{labels[i]}</span>
          </div>
        </li>
      )
    })}
  </ol>
)

const CompleteBooking = () => {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const { t } = useI18n()
  const { currency } = useAppContext()
  const api = guestApi

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState('documents')
  const [identityType, setIdentityType] = useState('national_id')
  const [uploading, setUploading] = useState('')
  const [signature, setSignature] = useState('')
  const [secondDriverSignature, setSecondDriverSignature] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [details, setDetails] = useState({
    customerFullName: '',
    customerEmail: '',
    customerPhone: '',
    dateOfBirth: '',
    nationality: '',
    customerAddress: '',
    placeOfBirth: '',
    identityDocumentNumber: '',
    identityIssuedOn: '',
    driverLicenseNumber: '',
    driverLicenseExpiry: '',
    driverLicenseIssuedOn: '',
    passportNumber: '',
    secondDriverEnabled: false,
    secondDriverFullName: '',
    secondDriverDob: '',
    secondDriverNationality: '',
    secondDriverPhone: '',
    secondDriverLicenseNumber: '',
    secondDriverLicenseExpiry: '',
    secondDriverPassportNumber: '',
  })
  const [detailsSaved, setDetailsSaved] = useState(true)
  const [savingDetails, setSavingDetails] = useState(false)
  const docGen = useDocumentGeneration()

  const c = booking?.completion

  const load = React.useCallback(async () => {
    try {
      const { data } = await api.get(`/api/booking-completion/${token}`)
      if (!data.success) throw new Error(data.message)
      setBooking(data.booking)
      setDetails({
        customerFullName: data.booking.customerName || '',
        customerEmail: data.booking.customerEmail || '',
        customerPhone: data.booking.customerPhone || '',
        dateOfBirth: data.booking.dateOfBirth || '',
        nationality: data.booking.nationality || '',
        customerAddress: data.booking.customerAddress || '',
        placeOfBirth: data.booking.placeOfBirth || '',
        identityDocumentNumber: data.booking.identityDocumentNumber || '',
        identityIssuedOn: data.booking.identityIssuedOn || '',
        driverLicenseNumber: data.booking.driverLicenseNumber || '',
        driverLicenseExpiry: data.booking.driverLicenseExpiry || '',
        driverLicenseIssuedOn: data.booking.driverLicenseIssuedOn || '',
        passportNumber: data.booking.passportNumber || '',
        secondDriverEnabled: data.booking.secondDriver?.enabled || false,
        secondDriverFullName: data.booking.secondDriver?.fullName || '',
        secondDriverDob: data.booking.secondDriver?.dateOfBirth || '',
        secondDriverNationality: data.booking.secondDriver?.nationality || '',
        secondDriverPhone: data.booking.secondDriver?.phone || '',
        secondDriverLicenseNumber: data.booking.secondDriver?.driverLicenseNumber || '',
        secondDriverLicenseExpiry: data.booking.secondDriver?.driverLicenseExpiry || '',
        secondDriverPassportNumber: data.booking.secondDriver?.passportNumber || '',
      })
      setDetailsSaved(true)
      setError('')
      if (data.booking.status === 'ready_for_pickup' || data.booking.completion?.completedAt) {
        setStep('done')
      } else if (!data.booking.completion?.documentsComplete) {
        setStep('documents')
      } else if (!data.booking.completion?.signatureComplete) {
        setStep('signature')
      } else {
        setStep('done')
      }
      if (data.booking.completion?.identityType) {
        setIdentityType(data.booking.completion.identityType)
      }
    } catch (err) {
      setError(getErrorMessage(err) || t('completion.invalidLink'))
    } finally {
      setLoading(false)
    }
  }, [api, token, t])

  useEffect(() => {
    load()
  }, [load])

  // Stripe return
  useEffect(() => {
    const paid = searchParams.get('paid')
    const sessionId = searchParams.get('session_id')
    if (!paid || !sessionId || !token) return
    const confirm = async () => {
      try {
        const { data } = await api.post(`/api/booking-completion/${token}/payment/stripe-confirm`, { sessionId })
        if (data.success) {
          setBooking(data.booking)
          toast.success(t('completion.paymentOk'))
          setStep(data.finalized ? 'done' : 'signature')
        }
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
    }
    confirm()
  }, [api, searchParams, t, token])

  const uploadDoc = async (docType, file) => {
    if (!file) return
    setUploading(docType)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('docType', docType)
      if (docType === 'identity') form.append('identityType', identityType)
      const { data } = await api.post(`/api/booking-completion/${token}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (!data.success) throw new Error(data.message)
      setBooking(data.booking)
      toast.success(t('completion.docUploaded'))
      if (data.booking.completion?.documentsComplete) setStep('signature')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading('')
    }
  }

  const updateDetail = (key, value) => {
    setDetails((prev) => ({ ...prev, [key]: value }))
    setDetailsSaved(false)
  }

  const buildDetailsPayload = () => ({
    customerName: details.customerFullName,
    customerEmail: details.customerEmail,
    customerPhone: details.customerPhone,
    dateOfBirth: details.dateOfBirth,
    nationality: details.nationality,
    customerAddress: details.customerAddress,
    placeOfBirth: details.placeOfBirth,
    identityDocumentNumber: details.identityDocumentNumber,
    identityIssuedOn: details.identityIssuedOn,
    driverLicenseNumber: details.driverLicenseNumber,
    driverLicenseExpiry: details.driverLicenseExpiry,
    driverLicenseIssuedOn: details.driverLicenseIssuedOn,
    passportNumber: details.passportNumber,
    secondDriver: {
      enabled: Boolean(details.secondDriverEnabled),
      fullName: details.secondDriverFullName,
      dateOfBirth: details.secondDriverDob,
      nationality: details.secondDriverNationality,
      phone: details.secondDriverPhone,
      driverLicenseNumber: details.secondDriverLicenseNumber,
      driverLicenseExpiry: details.secondDriverLicenseExpiry,
      passportNumber: details.secondDriverPassportNumber,
    },
  })

  const saveCompletionDetails = async ({ force = false } = {}) => {
    if (detailsSaved && !force) return booking
    setSavingDetails(true)
    try {
      const payload = buildDetailsPayload()
      const { data } = await api.post(`/api/booking-completion/${token}/details`, payload)
      if (!data.success) throw new Error(data.message)
      setBooking(data.booking)
      setDetailsSaved(true)
      toast.success(t('completion.detailsSaved'))
      return data.booking
    } catch (err) {
      toast.error(getErrorMessage(err) || t('completion.detailsSaveFailed'))
      throw err
    } finally {
      setSavingDetails(false)
    }
  }

  const validateClientDetails = () => {
    const missing = []
    const req = (value, label) => {
      if (!value || !String(value).trim()) missing.push(label)
    }
    req(details.customerFullName, t('completion.fieldFullName'))
    req(details.customerEmail, t('completion.fieldEmail'))
    req(details.customerPhone, t('completion.fieldPhone'))
    req(details.customerAddress, t('completion.fieldAddress'))
    req(details.dateOfBirth, t('completion.fieldDob'))
    req(details.nationality, t('completion.fieldNationality'))
    req(details.placeOfBirth, t('completion.fieldBirthPlace'))
    req(details.identityDocumentNumber, t('completion.fieldIdNumber'))
    req(details.identityIssuedOn, t('completion.fieldIdIssued'))
    req(details.driverLicenseNumber, t('completion.fieldLicenseNumber'))
    req(details.driverLicenseExpiry, t('completion.fieldLicenseExpiry'))
    req(details.driverLicenseIssuedOn, t('completion.fieldLicenseIssued'))
    if (details.secondDriverEnabled) {
      req(details.secondDriverFullName, t('completion.secondDriverNameLabel'))
      req(details.secondDriverDob, t('completion.secondDriverDob'))
      req(details.secondDriverLicenseNumber, t('completion.secondDriverLicense'))
    }
    if (missing.length) {
      toast.error(`${t('completion.missingFields')}: ${missing.join(', ')}`)
      return false
    }
    return true
  }

  const handleSign = async () => {
    if (!signature) {
      toast.error(t('completion.needSignature'))
      return
    }
    const secondDriverOn =
      details.secondDriverEnabled || Boolean(booking?.secondDriver?.enabled)
    if (secondDriverOn && !secondDriverSignature) {
      toast.error(t('completion.needSecondDriverSignature'))
      return
    }
    if (!agreed) {
      toast.error(t('completion.needAgree'))
      return
    }
    if (!validateClientDetails()) return
    if (docGen.running || signing) return

    setSigning(true)
    try {
      await docGen.run(
        async () => {
          await saveCompletionDetails({ force: true })
          const { data } = await api.post(`/api/booking-completion/${token}/signature`, {
            signatureDataUrl: signature,
            secondDriverSignatureDataUrl: secondDriverOn ? secondDriverSignature : undefined,
            agreed: true,
            ...buildDetailsPayload(),
          })
          if (!data.success) throw new Error(data.message)
          setBooking(data.booking)
          return data
        },
        {
          mode: 'finalize',
          extractPdfUrl: (data) => data?.booking?.completion?.contractPdfUrl || '',
          onSuccess: async (data) => {
            toast.success(data.message)
            // Smooth handoff to ready view after real backend success
            window.setTimeout(() => {
              setStep('done')
              docGen.close()
            }, 900)
          },
        },
      )
    } catch (err) {
      // Overlay shows error + retry; toast as secondary signal
      if (!docGen.open) toast.error(getErrorMessage(err))
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader /></div>

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-ink">{t('completion.invalidTitle')}</h1>
        <p className="mt-3 text-muted">{error}</p>
        <Link to="/" className="inline-block mt-8 px-5 py-2.5 rounded-xl bg-primary text-white text-sm">
          {t('completion.backHome')}
        </Link>
      </div>
    )
  }

  const docsDone = c?.documentsComplete
  const signDone = c?.signatureComplete
  const showSecondDriverSign =
    details.secondDriverEnabled || Boolean(booking?.secondDriver?.enabled)

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,_#f5efe8_0%,_#faf8f5_45%,_#f0ebe4_100%)] pb-20">
      <NoIndexHead title="Finaliser la réservation" />
      <DocumentGenerationOverlay
        open={docGen.open}
        status={docGen.status}
        mode={docGen.mode}
        error={docGen.error}
        pdfUrl={docGen.pdfUrl || c?.contractPdfUrl || ''}
        onRetry={() => docGen.retry()}
        onDismiss={() => {
          if (docGen.status === 'success') setStep('done')
          docGen.close()
        }}
        embedPdf={docGen.status === 'success'}
        position="fixed"
      />

      <div className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(165, 22, 36,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative page-pad py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">{t('completion.eyebrow')}</p>
            <h1 className="mt-2 font-display text-3xl md:text-[2.35rem] font-medium leading-tight">{t('completion.title')}</h1>
            <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
              <span className="font-medium text-white">{booking.reservationId}</span>
              <span className="text-white/40">·</span>
              <span>{booking.car?.brand} {booking.car?.model}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-pad -mt-8">
        <div className="max-w-3xl mx-auto space-y-6">
        <div className="rounded-3xl border border-borderColor/70 bg-white/90 p-4 sm:p-5 shadow-[0_24px_60px_-40px_rgba(22,18,16,0.5)] backdrop-blur-sm">
          <StepRail
            steps={STEPS}
            current={step}
            labels={[t('completion.stepDocs'), t('completion.stepSign'), t('completion.stepDone')]}
            doneFlags={[docsDone, signDone, step === 'done']}
          />
        </div>

        <Motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-borderColor/70 bg-white p-5 sm:p-8 shadow-[0_24px_60px_-44px_rgba(22,18,16,0.45)]"
        >
          {step === 'documents' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-ink">{t('completion.docsTitle')}</h2>
                <p className="text-sm text-muted mt-1">{t('completion.docsHint')}</p>
              </div>

              <SectionCard title={t('completion.contractDetailsTitle')} subtitle={t('completion.contractDetailsHint')} accent="from-sand/50 to-white">
                {!detailsSaved && (
                  <div className="flex justify-end -mt-2 mb-3">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                      {t('completion.unsavedHint')}
                    </span>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t('completion.fieldFullName')}>
                    <input value={details.customerFullName} onChange={(e) => updateDetail('customerFullName', e.target.value)} className={formInputOnLightClass} autoComplete="name" />
                  </Field>
                  <Field label={t('completion.fieldEmail')}>
                    <input type="email" value={details.customerEmail} onChange={(e) => updateDetail('customerEmail', e.target.value)} className={formInputOnLightClass} autoComplete="email" />
                  </Field>
                  <Field label={t('completion.fieldPhone')}>
                    <input type="tel" value={details.customerPhone} onChange={(e) => updateDetail('customerPhone', e.target.value)} className={formInputOnLightClass} autoComplete="tel" />
                  </Field>
                  <Field label={t('completion.fieldAddress')}>
                    <input value={details.customerAddress} onChange={(e) => updateDetail('customerAddress', e.target.value)} className={formInputOnLightClass} autoComplete="street-address" />
                  </Field>
                  <Field label={t('completion.fieldDob')}>
                    <input type="date" value={details.dateOfBirth} onChange={(e) => updateDetail('dateOfBirth', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldNationality')}>
                    <input value={details.nationality} onChange={(e) => updateDetail('nationality', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldBirthPlace')}>
                    <input value={details.placeOfBirth} onChange={(e) => updateDetail('placeOfBirth', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldIdNumber')}>
                    <input value={details.identityDocumentNumber} onChange={(e) => updateDetail('identityDocumentNumber', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldIdIssued')}>
                    <input type="date" value={details.identityIssuedOn} onChange={(e) => updateDetail('identityIssuedOn', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldLicenseNumber')}>
                    <input value={details.driverLicenseNumber} onChange={(e) => updateDetail('driverLicenseNumber', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldLicenseExpiry')}>
                    <input type="date" value={details.driverLicenseExpiry} onChange={(e) => updateDetail('driverLicenseExpiry', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldLicenseIssued')}>
                    <input type="date" value={details.driverLicenseIssuedOn} onChange={(e) => updateDetail('driverLicenseIssuedOn', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                  <Field label={t('completion.fieldPassport')} className="md:col-span-2">
                    <input value={details.passportNumber} onChange={(e) => updateDetail('passportNumber', e.target.value)} className={formInputOnLightClass} />
                  </Field>
                </div>

                <div className="rounded-2xl border border-borderColor bg-white p-4 mt-4">
                  <label className="flex items-start gap-3 text-sm text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={details.secondDriverEnabled}
                      onChange={(e) => updateDetail('secondDriverEnabled', e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-borderColor text-primary focus:ring-primary/30"
                    />
                    <span>{t('completion.secondDriverToggle')}</span>
                  </label>

                  {details.secondDriverEnabled && (
                    <div className="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t border-borderColor">
                      <Field label={t('completion.secondDriverNameLabel')}>
                        <input value={details.secondDriverFullName} onChange={(e) => updateDetail('secondDriverFullName', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                      <Field label={t('completion.secondDriverDob')}>
                        <input type="date" value={details.secondDriverDob} onChange={(e) => updateDetail('secondDriverDob', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                      <Field label={t('completion.fieldNationality')}>
                        <input value={details.secondDriverNationality} onChange={(e) => updateDetail('secondDriverNationality', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                      <Field label={t('completion.fieldPhone')}>
                        <input value={details.secondDriverPhone} onChange={(e) => updateDetail('secondDriverPhone', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                      <Field label={t('completion.secondDriverLicense')}>
                        <input value={details.secondDriverLicenseNumber} onChange={(e) => updateDetail('secondDriverLicenseNumber', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                      <Field label={t('completion.secondDriverLicenseExpiry')}>
                        <input type="date" value={details.secondDriverLicenseExpiry} onChange={(e) => updateDetail('secondDriverLicenseExpiry', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                      <Field label={t('completion.secondDriverPassport')} className="md:col-span-2">
                        <input value={details.secondDriverPassportNumber} onChange={(e) => updateDetail('secondDriverPassportNumber', e.target.value)} className={formInputOnLightClass} />
                      </Field>
                    </div>
                  )}
                </div>
              </SectionCard>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-borderColor bg-white p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{t('completion.license')}</p>
                      <p className="text-xs text-muted">{t('completion.required')}</p>
                    </div>
                    {c?.drivingLicenseUrl && <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">{t('completion.uploaded')}</span>}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!!uploading}
                    onChange={(e) => uploadDoc('driving_license', e.target.files?.[0])}
                    className="block w-full text-sm text-muted file:mr-3 file:mb-2 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white file:cursor-pointer"
                  />
                </div>

                <div className="rounded-2xl border border-borderColor bg-white p-4">
                  <p className="text-sm font-semibold text-ink mb-3">{t('completion.identity')}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['national_id', 'passport'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setIdentityType(type)}
                        className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer border transition-colors ${
                          identityType === type ? 'border-primary bg-primary/10 text-primary' : 'border-borderColor text-muted'
                        }`}
                      >
                        {type === 'national_id' ? t('completion.nationalId') : t('completion.passport')}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-xs text-muted">{t('completion.requiredOne')}</p>
                    {c?.identityDocumentUrl && <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">{t('completion.uploaded')}</span>}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!!uploading}
                    onChange={(e) => uploadDoc('identity', e.target.files?.[0])}
                    className="block w-full text-sm text-muted file:mr-3 file:mb-2 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white file:cursor-pointer"
                  />
                </div>
              </div>

              <div
                role="note"
                className="flex items-start gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50 px-3.5 py-3 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3.5"
              >
                <span className="text-base leading-none shrink-0 select-none sm:text-lg" aria-hidden>
                  🔒
                </span>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-700">
                  {t('completion.securityDepositBanner')}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={savingDetails}
                  onClick={() => saveCompletionDetails({ force: true })}
                  className="w-full py-3.5 rounded-2xl border border-borderColor bg-sand text-sm font-semibold text-ink"
                >
                  {savingDetails ? t('completion.savingDetails') : t('completion.saveDetails')}
                </button>
                {docsDone && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!validateClientDetails()) return
                      try {
                        await saveCompletionDetails({ force: true })
                        setStep('signature')
                      } catch {
                        // saveCompletionDetails already handles feedback
                      }
                    }}
                    className="w-full py-3.5 rounded-2xl bg-primary text-white text-sm font-semibold cursor-pointer shadow-[0_12px_28px_-16px_rgba(165, 22, 36,0.8)]"
                  >
                    {t('completion.continueSign')}
                  </button>
                )}
              </div>
            </div>
          )}


          {step === 'signature' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-ink">{t('completion.signTitle')}</h2>
                <p className="text-sm text-muted mt-1">{t('completion.signHint')}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">{t('completion.signatureCustomerLabel')}</p>
                <SignaturePad onChange={setSignature} disabled={signing || signDone} />
              </div>

              {showSecondDriverSign && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink">{t('completion.signatureSecondDriverLabel')}</p>
                  <p className="text-xs text-muted">
                    {details.secondDriverFullName || booking?.secondDriver?.fullName || '—'}
                  </p>
                  <SignaturePad onChange={setSecondDriverSignature} disabled={signing || signDone} />
                </div>
              )}

              <p className="text-xs text-muted">{t('completion.signatureAgencyNote')}</p>

              <label className="flex items-start gap-3 text-sm text-muted cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                <span>{t('completion.agreeTerms')}</span>
              </label>

              <button
                type="button"
                disabled={signing || signDone || docGen.running}
                onClick={handleSign}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dull text-white text-sm font-medium cursor-pointer disabled:opacity-60"
              >
                {signDone ? t('completion.signed') : (signing || docGen.running) ? t('completion.processing') : t('completion.signSubmit')}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700 text-2xl">✓</div>
              <h2 className="font-display text-3xl text-ink">{t('completion.readyTitle')}</h2>
              <p className="mt-2 text-muted text-sm max-w-md mx-auto">{t('completion.readyHint')}</p>

              <div className="mt-8 text-left rounded-xl border border-borderColor p-4 space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-ink">{t('confirmation.reference')}:</span> {booking.reservationId}</p>
                <p><span className="font-medium text-ink">{t('confirmation.vehicle')}:</span> {booking.car?.brand} {booking.car?.model}</p>
                <p><span className="font-medium text-ink">{t('confirmation.pickup')}:</span> {booking.pickupLocation}</p>
                <p><span className="font-medium text-ink">{t('confirmation.from')}:</span> {new Date(booking.pickupDate).toLocaleString()}</p>
                <p><span className="font-medium text-ink">{t('confirmation.total')}:</span> {currency}{booking.price}</p>
              </div>

              {c?.contractPdfUrl && (
                <div className="mt-6 text-left">
                  <p className="mb-2 text-sm font-medium text-ink">{t('completion.viewingContract')}</p>
                  <div className="overflow-hidden rounded-xl border border-borderColor bg-sand/30">
                    <iframe
                      title={t('docGen.pdfPreview')}
                      src={c.contractPdfUrl}
                      className="h-[min(70vh,32rem)] w-full bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                {c?.contractPdfUrl && (
                  <a href={c.contractPdfUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm">
                    {t('completion.downloadContract')}
                  </a>
                )}
              </div>

              <Link to="/" className="inline-block mt-8 text-sm text-primary hover:underline">{t('completion.backHome')}</Link>
            </div>
          )}
        </Motion.div>

        {step === 'signature' && (
          <button
            type="button"
            onClick={() => setStep('documents')}
            className="mt-4 text-sm text-muted hover:text-ink cursor-pointer"
          >
            ← {t('completion.back')}
          </button>
        )}
        </div>
      </div>
    </div>
  )
}

export default CompleteBooking
