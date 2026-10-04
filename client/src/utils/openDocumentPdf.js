const messageFromBlob = async (blob, fallback = 'PDF not available') => {
  if (!blob || typeof blob.text !== 'function') return fallback
  const text = await blob.text()
  try {
    return JSON.parse(text)?.message || text || fallback
  } catch {
    return text || fallback
  }
}

/**
 * Open an authenticated document PDF endpoint as a blob tab.
 * Avoids hitting ephemeral /uploads URLs that 404/500 after deploys.
 */
export async function openDocumentPdf(axios, apiPath, { filename = 'document.pdf' } = {}) {
  let response
  try {
    response = await axios.get(apiPath, {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
    })
  } catch (error) {
    const data = error.response?.data
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      throw new Error(await messageFromBlob(data, error.message || 'PDF not available'))
    }
    throw error
  }

  const contentType = String(response.headers?.['content-type'] || '')
  if (contentType.includes('application/json')) {
    throw new Error(await messageFromBlob(response.data))
  }

  const blob = new Blob([response.data], { type: 'application/pdf' })
  const objectUrl = URL.createObjectURL(blob)
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
  if (!opened) {
    // Popup blocked — fall back to download
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
  return objectUrl
}

export default openDocumentPdf
