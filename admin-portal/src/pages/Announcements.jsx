import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'

export default function Announcements() {
  const [form, setForm] = useState({ title: '', message: '', recipient_role: 'student', notification_type: 'announcement' })
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', 'announcements'],
    queryFn: () => apiClient.get('/activity-logs?limit=20').then((r) => r.data),
  })

  const broadcastMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/notifications/broadcast', payload),
    onSuccess: () => {
      push('Announcement sent!', 'success')
      setForm({ title: '', message: '', recipient_role: 'student', notification_type: 'announcement' })
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
    },
    onError: () => push('Failed to send', 'error'),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Announcements</h1>

      <Card className="max-w-lg space-y-4 p-6">
        <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
          <textarea className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none" rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
        </label>
        <Select label="Send To" value={form.recipient_role} onChange={(e) => setForm((f) => ({ ...f, recipient_role: e.target.value }))}>
          <option value="student">All Students</option>
          <option value="admin">All Admins</option>
          <option value="all">Everyone</option>
        </Select>
        <Button onClick={() => broadcastMutation.mutate(form)} disabled={!form.title || !form.message || broadcastMutation.isPending}>
          Send Announcement
        </Button>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Recent Activity</h2>
        <Card>
          {isLoading ? (
            <Spinner />
          ) : (
            <ul className="divide-y divide-slate-100">
              {logs?.map((l) => (
                <li key={l.id} className="p-3 text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{l.action.replace(/_/g, ' ')}</span> — {l.description || '—'}
                  <span className="ml-2 text-slate-400">{new Date(l.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
