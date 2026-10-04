import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../../utils/apiError'
import { SettingsCard, StatusPill, settingsUi, Field } from './settingsUi'

const StaffSettingsPanel = ({ axios, t }) => {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [owner, setOwner] = useState(null)
  const [roles, setRoles] = useState([])
  const [usage, setUsage] = useState({ seats: 1, maxStaff: null })
  const [inviteUrl, setInviteUrl] = useState('')
  const [form, setForm] = useState({ name: '', email: '', staffRole: 'agent' })
  const [busy, setBusy] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/owner/staff')
      if (!data.success) throw new Error(data.message || 'Failed to load staff')
      setMembers(data.members || [])
      setOwner(data.owner || null)
      setRoles(data.roles || [])
      setUsage(data.usage || { seats: 1, maxStaff: null })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [axios])

  const seatsLabel =
    usage.maxStaff == null ? `${usage.seats ?? 1} / ∞` : `${usage.seats ?? 1} / ${usage.maxStaff}`

  const invite = async (e) => {
    e.preventDefault()
    setBusy('invite')
    setInviteUrl('')
    try {
      const { data } = await axios.post('/api/owner/staff', form)
      if (!data.success) throw new Error(data.message || 'Invite failed')
      toast.success('Invite created — copy the link for your teammate')
      setInviteUrl(data.inviteUrl || '')
      setForm({ name: '', email: '', staffRole: 'agent' })
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted py-8">{t('admin.settings.loading') || 'Loading…'}</p>
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        eyebrow={t('admin.settings.staffEyebrow') || 'Team'}
        title={t('admin.settings.staffTitle') || 'Staff & members'}
        description={
          t('admin.settings.staffDesc') ||
          'Invite teammates with role-based access. Seats include you (owner) plus staff.'
        }
        action={<StatusPill tone="info">Seats {seatsLabel}</StatusPill>}
      >
        {owner ? (
          <div className="mb-4 rounded-2xl border border-borderColor/70 px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{owner.name}</p>
            <p className="text-xs text-muted">{owner.email} · Owner (full access)</p>
          </div>
        ) : null}

        <ul className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted">No staff members yet.</p>
          ) : (
            members.map((m) => (
              <li
                key={m._id}
                className="flex flex-col gap-2 rounded-2xl border border-borderColor/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.email} · <span className="capitalize">{m.staffRole || 'agent'}</span> ·{' '}
                    {m.accountStatus}
                    {m.invitePending ? ' · invite pending' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={`${settingsUi.select} !min-h-10 !text-sm w-auto`}
                    value={m.staffRole || 'agent'}
                    onChange={async (e) => {
                      try {
                        await axios.patch(`/api/owner/staff/${m._id}`, {
                          staffRole: e.target.value,
                        })
                        toast.success('Role updated')
                        await load()
                      } catch (err) {
                        toast.error(getErrorMessage(err))
                      }
                    }}
                  >
                    {(roles.length
                      ? roles
                      : [
                          { code: 'manager', label: 'Manager' },
                          { code: 'agent', label: 'Agent' },
                          { code: 'viewer', label: 'Viewer' },
                        ]
                    ).map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label || r.code}
                      </option>
                    ))}
                  </select>
                  {m.accountStatus === 'active' ? (
                    <button
                      type="button"
                      className={settingsUi.btnGhost}
                      onClick={async () => {
                        try {
                          await axios.patch(`/api/owner/staff/${m._id}`, {
                            accountStatus: 'suspended',
                          })
                          toast.success('Staff suspended')
                          await load()
                        } catch (err) {
                          toast.error(getErrorMessage(err))
                        }
                      }}
                    >
                      Suspend
                    </button>
                  ) : m.accountStatus === 'suspended' ? (
                    <button
                      type="button"
                      className={settingsUi.btnGhost}
                      onClick={async () => {
                        try {
                          await axios.patch(`/api/owner/staff/${m._id}`, {
                            accountStatus: 'active',
                          })
                          toast.success('Staff reactivated')
                          await load()
                        } catch (err) {
                          toast.error(getErrorMessage(err))
                        }
                      }}
                    >
                      Reactivate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={settingsUi.btnDanger}
                    onClick={async () => {
                      if (!window.confirm(`Remove ${m.email}?`)) return
                      try {
                        await axios.delete(`/api/owner/staff/${m._id}`)
                        toast.success('Staff removed')
                        await load()
                      } catch (err) {
                        toast.error(getErrorMessage(err))
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </SettingsCard>

      <SettingsCard
        title={t('admin.settings.staffInviteTitle') || 'Invite staff'}
        description={
          t('admin.settings.staffInviteDesc') ||
          'They receive an activation link to set their password. Counted against your plan seat limit.'
        }
      >
        <form onSubmit={invite} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={settingsUi.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={settingsUi.input}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </Field>
          <Field label="Role" className="sm:col-span-2">
            <select
              className={settingsUi.select}
              value={form.staffRole}
              onChange={(e) => setForm((f) => ({ ...f, staffRole: e.target.value }))}
            >
              {(roles.length
                ? roles
                : [
                    { code: 'manager', label: 'Manager' },
                    { code: 'agent', label: 'Agent' },
                    { code: 'viewer', label: 'Viewer' },
                  ]
              ).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} — {r.description || ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy === 'invite'} className={settingsUi.btnPrimary}>
              {busy === 'invite' ? 'Creating…' : 'Create invite'}
            </button>
          </div>
        </form>
        {inviteUrl ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-medium text-emerald-900">Activation link</p>
            <p className="mt-1 break-all text-xs text-emerald-900/80">{inviteUrl}</p>
            <button
              type="button"
              className={`${settingsUi.btnGhost} mt-2`}
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl)
                toast.success('Copied')
              }}
            >
              Copy link
            </button>
          </div>
        ) : null}
      </SettingsCard>
    </div>
  )
}

export default StaffSettingsPanel
