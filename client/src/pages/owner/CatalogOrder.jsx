import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Title from '../../components/owner/Title'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/apiError'
import { assets } from '../../assets/assets'

const groupKey = (group) => `${group.brandKey || group.brand}|${group.modelKey || group.model}`

const moveItem = (list, fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list
  if (fromIndex >= list.length || toIndex >= list.length) return list
  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

const CatalogOrder = () => {
  const { isOwner, axios, currency, fetchCars } = useAppContext()
  const { t } = useI18n()
  const fallbackImage = assets.car_image1

  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingCategory, setSavingCategory] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const loadOrder = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/owner/catalog-order')
      if (!data.success) {
        toast.error(data.message || t('admin.catalogOrder.loadError'))
        return
      }
      const nextSections = data.sections || []
      setSections(nextSections)
      setActiveCategory((prev) => {
        if (prev && nextSections.some((s) => s.category === prev)) return prev
        return nextSections[0]?.category || ''
      })
    } catch (error) {
      toast.error(getErrorMessage(error) || t('admin.catalogOrder.loadError'))
    } finally {
      setLoading(false)
    }
  }, [axios, t])

  useEffect(() => {
    if (isOwner) loadOrder()
  }, [isOwner, loadOrder])

  const activeSection = useMemo(
    () => sections.find((s) => s.category === activeCategory) || null,
    [sections, activeCategory]
  )

  const persistCategoryOrder = async (category, groups) => {
    setSavingCategory(category)
    try {
      const { data } = await axios.put('/api/owner/catalog-order', {
        category,
        items: groups.map((g) => ({ brand: g.brand, model: g.model })),
      })
      if (!data.success) {
        toast.error(data.message || t('admin.catalogOrder.saveError'))
        await loadOrder()
        return
      }
      setSections((prev) =>
        prev.map((section) =>
          section.category === category
            ? { ...section, groups: data.section?.groups || groups }
            : section
        )
      )
      toast.success(t('admin.catalogOrder.saved'))
      if (typeof fetchCars === 'function') fetchCars()
    } catch (error) {
      toast.error(getErrorMessage(error) || t('admin.catalogOrder.saveError'))
      await loadOrder()
    } finally {
      setSavingCategory('')
    }
  }

  const updateActiveGroups = (nextGroups, { persist = true } = {}) => {
    if (!activeCategory) return
    setSections((prev) =>
      prev.map((section) =>
        section.category === activeCategory ? { ...section, groups: nextGroups } : section
      )
    )
    if (persist) persistCategoryOrder(activeCategory, nextGroups)
  }

  const onDragStart = (index) => (event) => {
    setDragIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    // Improve drag ghost clarity in some browsers
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '0.55'
    }
  }

  const onDragEnd = (event) => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '1'
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  const onDragOver = (index) => (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (overIndex !== index) setOverIndex(index)
  }

  const onDrop = (index) => (event) => {
    event.preventDefault()
    const from = dragIndex ?? Number(event.dataTransfer.getData('text/plain'))
    const groups = activeSection?.groups || []
    if (!Number.isInteger(from) || from === index || !groups.length) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const next = moveItem(groups, from, index)
    setDragIndex(null)
    setOverIndex(null)
    updateActiveGroups(next)
  }

  const moveByOffset = (index, offset) => {
    const groups = activeSection?.groups || []
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= groups.length) return
    updateActiveGroups(moveItem(groups, index, nextIndex))
  }

  if (!isOwner) return null

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto w-full">
      <Title
        title={t('admin.catalogOrder.title')}
        subTitle={t('admin.catalogOrder.subtitle')}
      />

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">{t('admin.catalogOrder.loading')}</p>
      ) : !sections.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-500">{t('admin.catalogOrder.empty')}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const active = section.category === activeCategory
              return (
                <button
                  key={section.category}
                  type="button"
                  onClick={() => setActiveCategory(section.category)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-primary/40'
                  }`}
                >
                  <span>{section.category}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                      active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {section.groups.length}
                  </span>
                </button>
              )
            })}
          </div>

          {activeSection && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 md:px-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
                    {t('admin.catalogOrder.categoryLabel')}
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900">{activeSection.category}</h2>
                </div>
                <p className="text-xs text-gray-500 max-w-md text-right">
                  {savingCategory === activeSection.category
                    ? t('admin.catalogOrder.saving')
                    : t('admin.catalogOrder.dragHint')}
                </p>
              </div>

              {activeSection.groups.length <= 1 ? (
                <p className="px-5 py-8 text-sm text-gray-500">
                  {t('admin.catalogOrder.singleModel')}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100" role="list">
                  {activeSection.groups.map((group, index) => {
                    const isDragging = dragIndex === index
                    const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
                    return (
                      <li
                        key={groupKey(group)}
                        draggable={savingCategory !== activeSection.category}
                        onDragStart={onDragStart(index)}
                        onDragEnd={onDragEnd}
                        onDragOver={onDragOver(index)}
                        onDrop={onDrop(index)}
                        className={`flex items-center gap-3 px-3 py-3 md:px-5 md:py-3.5 transition-colors select-none ${
                          isDragging ? 'bg-primary/5' : isOver ? 'bg-amber-50' : 'bg-white hover:bg-gray-50/80'
                        }`}
                      >
                        <span
                          className="inline-flex h-9 w-9 shrink-0 cursor-grab active:cursor-grabbing items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500"
                          aria-hidden="true"
                          title={t('admin.catalogOrder.dragHandle')}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="5" cy="3" r="1.3" />
                            <circle cx="11" cy="3" r="1.3" />
                            <circle cx="5" cy="8" r="1.3" />
                            <circle cx="11" cy="8" r="1.3" />
                            <circle cx="5" cy="13" r="1.3" />
                            <circle cx="11" cy="13" r="1.3" />
                          </svg>
                        </span>

                        <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-sm font-semibold text-gray-800">
                          {index + 1}
                        </span>

                        <img
                          src={group.image || fallbackImage}
                          alt=""
                          className="h-12 w-16 shrink-0 rounded-lg object-cover bg-gray-100"
                          onError={(e) => {
                            e.currentTarget.src = fallbackImage
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">
                            {group.brand} {group.model}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {t('admin.catalogOrder.units', { count: group.unitCount || 1 })}
                            {group.pricePerDay != null && (
                              <>
                                {' · '}
                                {currency}
                                {group.pricePerDay}
                                {t('admin.fleet.perDay')}
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                          <button
                            type="button"
                            disabled={index === 0 || savingCategory === activeSection.category}
                            onClick={() => moveByOffset(index, -1)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/40 disabled:opacity-40"
                            aria-label={t('admin.catalogOrder.moveUp')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === activeSection.groups.length - 1 ||
                              savingCategory === activeSection.category
                            }
                            onClick={() => moveByOffset(index, 1)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/40 disabled:opacity-40"
                            aria-label={t('admin.catalogOrder.moveDown')}
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CatalogOrder
