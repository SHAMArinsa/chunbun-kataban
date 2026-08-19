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
        <div className="space-y-3">
          {classes.map((c) => (
            <Card key={c.id} className="rounded-2xl border-brand-100 bg-gradient-to-r from-white via-white to-brand-50/50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-brand-100 p-3 text-brand-600">
                    <Video size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-xl font-bold text-brand-800">{c.title}</p><Badge color={STATUS_COLOR[c.status]}>{c.status}</Badge></div>
                    {domainName(c.domain_id) && <p className="mt-1 text-sm font-semibold text-brand-600">{domainName(c.domain_id)}</p>}
                    <p className="mt-1 text-base text-slate-600">Instructor: {c.instructor_name} · {c.scheduled_date} · {c.start_time}–{c.end_time}</p>
                  </div>
                </div>
                <Button className="shrink-0 !px-5 !py-3 !text-base" disabled={c.status === 'cancelled'} onClick={() => joinMutation.mutate(c.id)}>Join Class</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center">
          <p className="text-base font-semibold text-slate-900">12 live classes are included in the Platinum Program.</p>
          <p className="mt-2 text-sm text-slate-500">
            Class schedules and Google Meet links will be shared only to your registered email address.
          </p>
        </Card>
      )}
    </div>
  )
}
