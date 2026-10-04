import { useCallback, useRef, useState } from 'react'
import { getErrorMessage } from '../utils/apiError'

/**
 * Shared async state for real document/PDF generation requests.
 * Status tracks the live promise — never uses fake timers for completion.
 */
export function useDocumentGeneration() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle') // idle | running | success | error
  const [mode, setMode] = useState('regenerate') // finalize | regenerate | generate
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const lastJobRef = useRef(null)
  const blobUrlRef = useRef('')

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = ''
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setStatus('idle')
    setError('')
    revokeBlob()
    setPdfUrl('')
    lastJobRef.current = null
  }, [revokeBlob])

  const run = useCallback(async (jobFn, options = {}) => {
    const {
      mode: nextMode = 'regenerate',
      onSuccess,
      axios,
      extractPdfApiPath,
      extractPdfUrl = (result) =>
        result?.pdfUrl
        || result?.contract?.pdfUrl
        || result?.invoice?.pdfUrl
        || result?.booking?.completion?.contractPdfUrl
        || '',
    } = options

    lastJobRef.current = { jobFn, options }
    setMode(nextMode)
    setError('')
    revokeBlob()
    setPdfUrl('')
    setOpen(true)
    setStatus('running')

    try {
      const result = await jobFn()
      let url = extractPdfUrl(result) || ''

      // Prefer authenticated PDF stream → blob URL (survives missing /uploads files)
      const apiPath = typeof extractPdfApiPath === 'function' ? extractPdfApiPath(result) : ''
      if (apiPath && axios) {
        try {
          const res = await axios.get(apiPath, {
            responseType: 'blob',
            headers: { Accept: 'application/pdf' },
          })
          const type = String(res.headers?.['content-type'] || '')
          if (!type.includes('application/json')) {
            const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
            blobUrlRef.current = blobUrl
            url = blobUrl
          }
        } catch {
          /* keep fallback url */
        }
      }

      setPdfUrl(url)
      setStatus('success')
      if (onSuccess) await onSuccess(result)
      return result
    } catch (err) {
      setStatus('error')
      setError(getErrorMessage(err))
      throw err
    }
  }, [revokeBlob])

  const retry = useCallback(async () => {
    const last = lastJobRef.current
    if (!last) return
    return run(last.jobFn, last.options)
  }, [run])

  return {
    open,
    status,
    mode,
    error,
    pdfUrl,
    running: status === 'running',
    run,
    retry,
    close,
  }
}

export default useDocumentGeneration
