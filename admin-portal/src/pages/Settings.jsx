import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const SMTP_KEYS = [
  { key: 'smtp_host', label: 'SMTP Host' },
  { key: 'smtp_port', label: 'SMTP Port' },
  { key: 'smtp_user', label: 'SMTP Username' },
  { key: 'smtp_from', label: 'From Address' },
]

export default function Settings() {
  const { push } = useToast()
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

  if (isLoading) return <Spinner />

  const valueFor = (key) => form[key] ?? settings?.find((s) => s.key === key)?.value ?? ''

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

      <p className="text-sm text-slate-500">Admin accounts and their access are managed in <b>Admins &amp; Access</b> (super admins only).</p>
    </div>
  )
}
