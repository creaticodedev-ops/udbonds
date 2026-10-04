import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin, saError } from '../../context/SuperAdminContext'
import { useI18n } from '../../i18n/I18nContext'
import PermissionMatrix from '../../components/superadmin/PermissionMatrix'
import {
  SaCard,
  SaField,
  SaPageHeader,
  SaSkeleton,
  SaStat,
  confirmDestructive,
  sa,
} from './saUi'

const SuperAdminAdminDetail = () => {
  const { id } = useParams()
  const { axios, navigate } = useSuperAdmin()
  const { t } = useI18n()
  const [admin, setAdmin] = useState(null)
  const [stats, setStats] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [peerAdmins, setPeerAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState({ name: '', email: '', agencyName: '', notes: '' })
  const [permissions, setPermissions] = useState([])
  const [savedPermissions, setSavedPermissions] = useState([])
  const [newPassword, setNewPassword] = useState('')
  const [extendDays, setExtendDays] = useState(7)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data }, peersRes] = await Promise.all([
        axios.get(`/api/super-admin/admins/${id}`),
        axios.get('/api/super-admin/admins?limit=100').catch(() => ({ data: null })),
      ])
      if (data.success) {
        setAdmin(data.admin)
        setStats(data.stats)
        setCatalog(data.permissionCatalog || [])
        setEdit({
          name: data.admin.name || '',
          email: data.admin.email || '',
          agencyName: data.admin.agencyName || '',
          notes: data.admin.notes || '',
        })
        const perms = Array.isArray(data.admin.permissions) ? data.admin.permissions : []
        setPermissions([...perms])
        setSavedPermissions([...perms])
      }
      if (peersRes?.data?.success) {
        setPeerAdmins(peersRes.data.admins || [])
      }
    } catch (error) {
      toast.error(saError(error))
      navigate('/superadmin/admins')
    } finally {
      setLoading(false)
    }
  }, [axios, id, navigate])

  useEffect(() => {
    load()
  }, [load])

  const run = async (key, fn) => {
    setBusy(key)
    try {
      await fn()
      await load()
    } catch (error) {
      toast.error(saError(error))
    } finally {
      setBusy('')
    }
  }

  if (loading || !admin) {
    return (
      <div className={sa.page}>
        <SaSkeleton className="h-8 w-48" />
        <SaSkeleton className="h-24 w-full mt-6" />
      </div>
    )
  }

  const lic = admin.license || {}

  return (
    <div className={sa.page}>
      <SaPageHeader
        breadcrumb={
          <Link to="/superadmin/admins" className={`${sa.btnGhost} -ml-2`}>
            ← All admins
          </Link>
        }
        title={admin.name}
        subtitle={admin.email}
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <SaStat label="Account" value={admin.accountStatus} />
        <SaStat
          label="License"
          value={lic.licenseStatus}
          hint={
            lic.licenseStatus === 'trial' && lic.daysRemaining != null
              ? `${lic.daysRemaining} days remaining`
              : undefined
          }
        />
        <SaStat
          label="Usage"
          value={`${stats?.cars ?? 0} cars`}
          hint={`${stats?.bookings ?? 0} bookings · ${stats?.customers ?? 0} customers`}
        />
      </div>

      <SaCard title="Profile">
        <div className="grid sm:grid-cols-2 gap-4">
          {['name', 'email', 'agencyName'].map((key) => (
            <SaField key={key} label={key === 'agencyName' ? 'Agency' : key}>
              <input
                value={edit[key]}
                onChange={(e) => setEdit((f) => ({ ...f, [key]: e.target.value }))}
                className={sa.input}
              />
            </SaField>
          ))}
          <SaField label="Notes" className="sm:col-span-2">
            <textarea
              rows={2}
              value={edit.notes}
              onChange={(e) => setEdit((f) => ({ ...f, notes: e.target.value }))}
              className={sa.input}
            />
          </SaField>
        </div>
        <button
          type="button"
          disabled={busy === 'profile'}
          onClick={() =>
            run('profile', async () => {
              const { data } = await axios.patch(`/api/super-admin/admins/${id}`, edit)
              if (!data.success) throw new Error(data.message)
              toast.success('Profile updated')
            })
          }
          className={`${sa.btnPrimary} mt-4`}
        >
          Save profile
        </button>
      </SaCard>

      <SaCard title="Lock / unlock" description="Suspend, disable, or restore access. Business data is never deleted.">
        <div className="flex flex-wrap gap-2">
          {['active', 'suspended', 'disabled'].map((status) => (
            <button
              key={status}
              type="button"
              disabled={busy === `status-${status}` || admin.accountStatus === status}
              onClick={() => {
                if (status !== 'active' && !confirmDestructive(`Set account to ${status}?`)) return
                run(`status-${status}`, async () => {
                  const { data } = await axios.patch(`/api/super-admin/admins/${id}/status`, { status })
                  if (!data.success) throw new Error(data.message)
                  toast.success(`Account ${status}`)
                })
              }}
              className={admin.accountStatus === status ? `${sa.btnPrimary} capitalize` : `${sa.btnSecondary} capitalize`}
            >
              {status}
            </button>
          ))}
        </div>
      </SaCard>

      <SaCard title="License & trial">
        <p className="text-xs text-[var(--sa-text-muted)] mb-4">
          Trial ends: {lic.trialEndsAt ? new Date(lic.trialEndsAt).toLocaleString() : '—'}
          {lic.licensedAt ? ` · Licensed: ${new Date(lic.licensedAt).toLocaleString()}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run('activate', async () => {
                const { data } = await axios.post(`/api/super-admin/admins/${id}/license`, { action: 'activate' })
                if (!data.success) throw new Error(data.message)
                toast.success('Full license activated')
              })
            }
            className={sa.btnPrimary}
          >
            Activate full license
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run('trial', async () => {
                const { data } = await axios.post(`/api/super-admin/admins/${id}/license`, {
                  action: 'trial',
                  days: extendDays,
                })
                if (!data.success) throw new Error(data.message)
                toast.success('Fresh trial started')
              })
            }
            className={sa.btnSecondary}
          >
            Start / renew trial
          </button>
          <input
            type="number"
            min={1}
            max={365}
            value={extendDays}
            onChange={(e) => setExtendDays(Number(e.target.value) || 7)}
            className={`${sa.input} w-20`}
          />
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run('extend', async () => {
                const { data } = await axios.post(`/api/super-admin/admins/${id}/license`, {
                  action: 'extend',
                  days: extendDays,
                })
                if (!data.success) throw new Error(data.message)
                toast.success(`Extended by ${extendDays} days`)
              })
            }
            className={sa.btnSecondary}
          >
            Extend
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              if (!confirmDestructive('Expire license now? Dashboard will be locked.')) return
              run('expire', async () => {
                const { data } = await axios.post(`/api/super-admin/admins/${id}/license`, { action: 'expire' })
                if (!data.success) throw new Error(data.message)
                toast.success('License expired')
              })
            }}
            className={sa.btnDanger}
          >
            Expire now
          </button>
        </div>
      </SaCard>

      {/* Permissions — enterprise matrix (same API / permission keys) */}
      <PermissionMatrix
        catalog={catalog}
        value={permissions}
        baseline={savedPermissions}
        onChange={setPermissions}
        peerAdmins={peerAdmins}
        currentAdminId={admin._id}
        currentAdminName={admin.name || admin.email}
        saving={busy === 'perms'}
        updatedAt={admin.updatedAt}
        onSave={(next) =>
          run('perms', async () => {
            const { data } = await axios.patch(`/api/super-admin/admins/${id}/permissions`, {
              permissions: next,
            })
            if (!data.success) throw new Error(data.message)
            toast.success(t('superadmin.perms.saveSuccess'))
            const saved = Array.isArray(data.admin?.permissions) ? data.admin.permissions : next
            setPermissions([...saved])
            setSavedPermissions([...saved])
          })
        }
      />

      {/* Password */}
      <SaCard title="Reset password">
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            minLength={8}
            placeholder="New password (min 8)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`${sa.input} flex-1 min-w-[12rem]`}
          />
          <button
            type="button"
            disabled={busy === 'password' || newPassword.length < 8}
            onClick={() =>
              run('password', async () => {
                const { data } = await axios.post(`/api/super-admin/admins/${id}/password`, {
                  password: newPassword,
                })
                if (!data.success) throw new Error(data.message)
                toast.success('Password reset')
                setNewPassword('')
              })
            }
            className={sa.btnPrimary}
          >
            Reset
          </button>
        </div>
      </SaCard>

      <SaCard
        title="Danger zone"
        description="If the admin has cars or bookings, the account is disabled instead of deleted."
        className="border-[var(--sa-danger)]/30"
      >
        <button
          type="button"
          disabled={busy === 'delete'}
          onClick={() => {
            if (!confirmDestructive(`Delete or disable ${admin.email}?`)) return
            run('delete', async () => {
              const { data } = await axios.delete(`/api/super-admin/admins/${id}`)
              if (!data.success) throw new Error(data.message)
              toast.success(data.message)
              if (!data.softDeleted) navigate('/superadmin/admins')
            })
          }}
          className={sa.btnDanger}
        >
          Delete / disable account
        </button>
      </SaCard>
    </div>
  )
}

export default SuperAdminAdminDetail
