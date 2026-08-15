import { useQuery, useMutation } from '@tanstack/react-query'
import { Video } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

const STATUS_COLOR = { scheduled: 'blue', completed: 'green', cancelled: 'red' }

const DOMAIN_LABEL = {
  python: 'Python Programming',
  web_dev: 'Web Development',
  database: 'Database',
  ai: 'Artificial Intelligence',
  genai: 'Generative AI',
  software_engineering: 'Software Engineering',
}

export default function LiveClasses() {
  const { data: classes, isLoading } = useQuery({
    queryKey: ['live-classes'],
    queryFn: () => apiClient.get('/live-classes').then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  const platinumProgram = programs?.find((p) => p.code === 'platinum')
  const domainName = (domainId) => {
    const d = platinumProgram?.domains?.find((d) => d.id === domainId)
    return d ? DOMAIN_LABEL[d.name] ?? d.name : null
  }

  const joinMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/live-classes/${id}/join`),
    onSuccess: (res) => window.open(res.data.meet_link, '_blank', 'noopener,noreferrer'),
  })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Live Classes</h1>
        <p className="text-sm text-slate-500">Available for Platinum Program students. Classes are hosted on Google Meet.</p>
      </div>

      {classes?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                  <Video size={18} />
                </div>
                <Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge>
              </div>
              <p className="text-sm font-medium text-slate-900">{c.title}</p>
              {domainName(c.domain_id) && <p className="text-xs font-medium text-brand-600">{domainName(c.domain_id)}</p>}
              <p className="text-xs text-slate-500">Instructor: {c.instructor_name}</p>
              <p className="text-xs text-slate-500">{c.scheduled_date} · {c.start_time}–{c.end_time}</p>
              <Button
                className="mt-2"
                disabled={c.status === 'cancelled'}
                onClick={() => joinMutation.mutate(c.id)}
              >
                Join Class
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">No live classes scheduled. Live classes will be scheduled soon.</Card>
      )}
    </div>
  )
}
