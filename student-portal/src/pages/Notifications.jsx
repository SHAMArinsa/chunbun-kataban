import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

export default function Notifications() {
  const queryClient = useQueryClient()
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then((r) => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id) => apiClient.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>

      {notifications?.length ? (
        <Card className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex cursor-pointer items-start gap-3 p-4 ${!n.is_read ? 'bg-brand-50/40' : ''}`}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
            >
              <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                <Bell size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  {!n.is_read && <Badge color="blue">New</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">No notifications yet.</Card>
      )}
    </div>
  )
}
