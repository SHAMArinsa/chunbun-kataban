import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'

const SMTP_KEYS = [
  { key: 'smtp_host', label: 'SMTP Host' },
  { key: 'smtp_port', label: 'SMTP Port' },
  { key: 'smtp_user', label: 'SMTP Username' },
  { key: 'smtp_from', label: 'From Address' },
]

const EMPTY_ADMIN_FORM = { email: '', password: '', full_name: '', designation: '', department: '', is_super_admin: false }

export default function Settings() {
  const { push } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'smtp'],
    queryFn: () => apiClient.get('/settings', { params: { category: 'smtp' } }).then((r) => r.data),
  })
  const [form, setForm] = useState({})

  const upsertMutation = useMutation({
    mutationFn: (payload) => apiClient.put('/settings', { category: 'smtp', ...payload }),
    onSuccess: () => {
      push('Setting saved!', 'success')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const { data: admins, isLoading: loadingAdmins } = useQuery({
    queryKey: ['admins'],
    queryFn: () => apiClient.get('/admins').then((r) => r.data),
  })
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_FORM)

  const createAdminMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/admins', payload),
    onSuccess: () => {
      push('Admin account created!', 'success')
      queryClient.invalidateQueries({ queryKey: ['admins'] })
      setAdminForm(EMPTY_ADMIN_FORM)
    },
    onError: (err) => push(err.response?.data?.detail || 'Could not create admin', 'error'),
  })

  const toggleSuperAdminMutation = useMutation({
    mutationFn: ({ adminId, isSuperAdmin }) => apiClient.put(`/admins/${adminId}`, { is_super_admin: isSuperAdmin }),
    onSuccess: () => {
      push('Admin updated.', 'success')
      queryClient.invalidateQueries({ queryKey: ['admins'] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Update failed', 'error'),
  })

  if (isLoading) return <Spinner />

  const valueFor = (key) => form[key] ?? settings?.find((s) => s.key === key)?.value ?? ''

  const adminColumns = [
    { key: 'full_name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'designation', header: 'Designation', render: (r) => r.designation || '—' },
    { key: 'is_super_admin', header: 'Role', render: (r) => <Badge color={r.is_super_admin ? 'blue' : 'slate'}>{r.is_super_admin ? 'Super Admin' : 'Admin'}</Badge> },
    {
      key: 'action',
      header: '',
      render: (r) => (
        <Button
          variant="secondary"
          onClick={() => toggleSuperAdminMutation.mutate({ adminId: r.id, isSuperAdmin: !r.is_super_admin })}
          disabled={toggleSuperAdminMutation.isPending || (r.user_id === user?.id && r.is_super_admin)}
        >
          {r.is_super_admin ? 'Revoke Super Admin' : 'Make Super Admin'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      <Card className="max-w-lg space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">SMTP Configuration</h2>
        <p className="text-xs text-slate-500">
          Without real SMTP credentials configured, outgoing emails are logged instead of sent — in-app notifications remain fully functional either way.
        </p>
        {SMTP_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-end gap-2">
            <div className="flex-1">
              <Input label={label} value={valueFor(key)} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
            <Button variant="secondary" onClick={() => upsertMutation.mutate({ key, value: form[key] ?? '' })} disabled={upsertMutation.isPending}>
              Save
            </Button>
          </div>
        ))}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">Admin Management</h2>
        <p className="text-xs text-slate-500">Only super admins can create new admin accounts or grant/revoke super admin access.</p>
        {loadingAdmins ? <Spinner /> : <Table columns={adminColumns} rows={admins} emptyMessage="No admins yet." />}

        <div className="border-t border-slate-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Add New Admin</h3>
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <Input label="Full Name" value={adminForm.full_name} onChange={(e) => setAdminForm((f) => ({ ...f, full_name: e.target.value }))} />
            <Input label="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))} />
            <Input label="Designation (optional)" value={adminForm.designation} onChange={(e) => setAdminForm((f) => ({ ...f, designation: e.target.value }))} />
            <Input label="Department (optional)" value={adminForm.department} onChange={(e) => setAdminForm((f) => ({ ...f, department: e.target.value }))} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={adminForm.is_super_admin} onChange={(e) => setAdminForm((f) => ({ ...f, is_super_admin: e.target.checked }))} />
              Grant super admin access
            </label>
          </div>
          <Button
            className="mt-4"
            onClick={() => createAdminMutation.mutate(adminForm)}
            disabled={!adminForm.full_name || !adminForm.email || adminForm.password.length < 8 || createAdminMutation.isPending}
          >
            Create Admin
          </Button>
        </div>
      </Card>
    </div>
  )
}
