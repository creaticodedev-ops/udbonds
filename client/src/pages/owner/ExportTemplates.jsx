import React, { useEffect, useMemo, useState } from 'react'
import Title from '../../components/owner/Title'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'

const emptyForm = {
  name: '',
  type: 'contract',
  headerHtml: '',
  bodyHtml: '',
  footerHtml: '',
  customCss: '',
  pageSize: 'A4',
  isDefault: false,
  logoUrl: '',
  companySignatureUrl: '',
}

const ExportTemplates = () => {
  const { axios } = useAppContext()
  const { t } = useI18n()
  const [templates, setTemplates] = useState([])
  const [variables, setVariables] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const inputClass = 'border border-borderColor px-3 py-2 rounded-lg w-full text-sm'
  const labelClass = 'text-xs font-medium text-gray-600'

  const groupedVariables = useMemo(() => {
    const groups = {}
    variables.forEach((v) => {
      if (!groups[v.group]) groups[v.group] = []
      groups[v.group].push(v)
    })
    return groups
  }, [variables])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const params = filterType ? `?type=${filterType}` : ''
      const { data } = await axios.get(`/api/export-templates${params}`)
      if (data.success) setTemplates(data.templates || [])
      else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [filterType])

  useEffect(() => {
    axios.get('/api/export-templates/variables')
      .then(({ data }) => { if (data.success) setVariables(data.variables || []) })
      .catch(() => {})
  }, [axios])

  const openCreate = () => {
    setEditing('new')
    setForm(emptyForm)
    setPreviewHtml('')
    setShowPreview(false)
  }

  const openEdit = (template) => {
    setEditing(template._id)
    setForm({
      name: template.name || '',
      type: template.type || 'contract',
      headerHtml: template.headerHtml || '',
      bodyHtml: template.bodyHtml || '',
      footerHtml: template.footerHtml || '',
      customCss: template.customCss || '',
      pageSize: template.pageSize || 'A4',
      isDefault: Boolean(template.isDefault),
      logoUrl: template.logoUrl || '',
      companySignatureUrl: template.companySignatureUrl || '',
    })
    setPreviewHtml('')
    setShowPreview(false)
  }

  const closeEditor = () => {
    setEditing(null)
    setForm(emptyForm)
    setPreviewHtml('')
    setShowPreview(false)
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const insertVariable = (key) => {
    setForm((f) => ({ ...f, bodyHtml: `${f.bodyHtml}{{${key}}}` }))
  }

  const saveTemplate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('admin.templates.nameRequired'))
      return
    }
    setSaving(true)
    try {
      const { logoUrl: _logoUrl, companySignatureUrl: _sigUrl, ...rest } = form
      const payload = { ...rest, name: form.name.trim() }
      const { data } = editing === 'new'
        ? await axios.post('/api/export-templates', payload)
        : await axios.put(`/api/export-templates/${editing}`, payload)

      if (data.success) {
        toast.success(data.message)
        closeEditor()
        fetchTemplates()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async (id) => {
    if (!window.confirm(t('admin.templates.deleteConfirm'))) return
    try {
      const { data } = await axios.delete(`/api/export-templates/${id}`)
      if (data.success) {
        toast.success(data.message)
        if (editing === id) closeEditor()
        fetchTemplates()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const uploadLogo = async (templateId, file) => {
    if (!file) return
    const body = new FormData()
    body.append('logo', file)
    try {
      const { data } = await axios.post(`/api/export-templates/${templateId}/logo`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.success) {
        toast.success(data.message)
        setForm((f) => ({ ...f, logoUrl: data.logoUrl || data.template?.logoUrl || '' }))
        fetchTemplates()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const uploadSignature = async (templateId, file) => {
    if (!file) return
    const body = new FormData()
    body.append('signature', file)
    try {
      const { data } = await axios.post(`/api/export-templates/${templateId}/signature`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data.success) {
        toast.success(data.message)
        setForm((f) => ({
          ...f,
          companySignatureUrl: data.companySignatureUrl || data.template?.companySignatureUrl || '',
        }))
        fetchTemplates()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const clearLogo = async (templateId) => {
    try {
      const { data } = await axios.delete(`/api/export-templates/${templateId}/logo`)
      if (data.success) {
        toast.success(data.message)
        setForm((f) => ({ ...f, logoUrl: '' }))
        fetchTemplates()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const clearSignature = async (templateId) => {
    try {
      const { data } = await axios.delete(`/api/export-templates/${templateId}/signature`)
      if (data.success) {
        toast.success(data.message)
        setForm((f) => ({ ...f, companySignatureUrl: '' }))
        fetchTemplates()
      } else toast.error(data.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const runPreview = async () => {
    if (editing === 'new') {
      toast.error(t('admin.templates.saveBeforePreview'))
      return
    }
    try {
      const { data } = await axios.post('/api/export-templates/preview', { templateId: editing })
      if (data.success) {
        setPreviewHtml(data.html)
        setShowPreview(true)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="px-4 pt-8 md:px-8 lg:px-10 xl:px-12 md:pt-10 flex-1 pb-12 min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <Title title={t('admin.templates.title')} subTitle={t('admin.templates.subtitle')} />
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
        >
          {t('admin.templates.create')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'contract', 'invoice', 'custom'].map((type) => (
          <button
            key={type || 'all'}
            type="button"
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filterType === type
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-700 border-borderColor'
            }`}
          >
            {type ? t(`admin.templates.type.${type}`) : t('admin.templates.type.all')}
          </button>
        ))}
      </div>

      {editing && (
        <form onSubmit={saveTemplate} className="rounded-2xl border border-borderColor bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-lg">
              {editing === 'new' ? t('admin.templates.create') : t('admin.templates.edit')}
            </h2>
            <button type="button" onClick={closeEditor} className="text-sm text-gray-500 hover:text-gray-800">
              {t('admin.common.cancel')}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>{t('admin.templates.name')}</label>
              <input className={inputClass} value={form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>{t('admin.templates.typeLabel')}</label>
              <select className={inputClass} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="contract">{t('admin.templates.type.contract')}</option>
                <option value="invoice">{t('admin.templates.type.invoice')}</option>
                <option value="custom">{t('admin.templates.type.custom')}</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>{t('admin.templates.pageSize')}</label>
              <select className={inputClass} value={form.pageSize} onChange={(e) => setField('pageSize', e.target.value)}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mt-6">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setField('isDefault', e.target.checked)} />
              {t('admin.templates.setDefault')}
            </label>
          </div>

          {editing !== 'new' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>{t('admin.templates.logo')}</label>
                {form.logoUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-borderColor bg-light/40 p-3">
                    <img
                      src={form.logoUrl}
                      alt=""
                      className="h-12 max-w-[140px] object-contain bg-white rounded"
                    />
                    <button
                      type="button"
                      onClick={() => clearLogo(editing)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('admin.templates.removeLogo')}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{t('admin.templates.noLogo')}</p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm"
                  onChange={(e) => {
                    uploadLogo(editing, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>{t('admin.templates.companySignature')}</label>
                {form.companySignatureUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-borderColor bg-light/40 p-3">
                    <img
                      src={form.companySignatureUrl}
                      alt=""
                      className="h-12 max-w-[180px] object-contain bg-white rounded"
                    />
                    <button
                      type="button"
                      onClick={() => clearSignature(editing)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('admin.templates.removeSignature')}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{t('admin.templates.noSignature')}</p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm"
                  onChange={(e) => {
                    uploadSignature(editing, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className={labelClass}>{t('admin.templates.header')}</label>
            <textarea className={`${inputClass} font-mono min-h-[80px]`} value={form.headerHtml} onChange={(e) => setField('headerHtml', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>{t('admin.templates.body')}</label>
            <textarea className={`${inputClass} font-mono min-h-[220px]`} value={form.bodyHtml} onChange={(e) => setField('bodyHtml', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>{t('admin.templates.footer')}</label>
            <textarea className={`${inputClass} font-mono min-h-[80px]`} value={form.footerHtml} onChange={(e) => setField('footerHtml', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>{t('admin.templates.customCss')}</label>
            <textarea className={`${inputClass} font-mono min-h-[60px]`} value={form.customCss} onChange={(e) => setField('customCss', e.target.value)} />
          </div>

          <div className="rounded-xl border border-dashed border-borderColor p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('admin.templates.variables')}</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(groupedVariables).map(([group, items]) => (
                <div key={group}>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{group}</p>
                  <div className="flex flex-wrap gap-1">
                    {items.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className="px-2 py-0.5 rounded bg-light text-xs text-gray-700 hover:bg-gray-200"
                        title={v.label}
                      >
                        {`{{${v.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-white text-sm disabled:opacity-60">
              {saving ? t('admin.templates.saving') : t('admin.shell.save')}
            </button>
            {editing !== 'new' && (
              <button type="button" onClick={runPreview} className="px-4 py-2 rounded-xl border border-borderColor text-sm">
                {t('admin.templates.preview')}
              </button>
            )}
          </div>

          {showPreview && previewHtml && (
            <div className="border border-borderColor rounded-xl overflow-hidden">
              <iframe
                title="Template preview"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full min-h-[480px] bg-white"
              />
            </div>
          )}
        </form>
      )}

      <div className="rounded-2xl border border-borderColor bg-white overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">{t('admin.templates.loading')}</p>
        ) : templates.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">{t('admin.templates.none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-light text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3">{t('admin.templates.name')}</th>
                  <th className="px-4 py-3">{t('admin.templates.typeLabel')}</th>
                  <th className="px-4 py-3">{t('admin.templates.default')}</th>
                  <th className="px-4 py-3">{t('admin.templates.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template._id} className="border-t border-borderColor">
                    <td className="px-4 py-3 font-medium">{template.name}</td>
                    <td className="px-4 py-3 capitalize">{t(`admin.templates.type.${template.type}`)}</td>
                    <td className="px-4 py-3">{template.isDefault ? '✓' : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEdit(template)} className="text-primary text-xs font-medium">
                          {t('admin.templates.edit')}
                        </button>
                        {!template.isDefault && (
                          <button type="button" onClick={() => deleteTemplate(template._id)} className="text-red-600 text-xs font-medium">
                            {t('admin.templates.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExportTemplates
