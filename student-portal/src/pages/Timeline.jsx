import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

const TYPE_COLOR = { assessment: 'blue', coding_test: 'yellow', project: 'green', live_class: 'slate', capstone: 'red', mock_interview: 'red' }

export default function Timeline() {
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })
  const activeEnrollment = enrollments?.find((e) => e.status === 'active') ?? enrollments?.[0]

  const { data: program, isLoading: loadingProgram } = useQuery({
    queryKey: ['program', activeEnrollment?.program_id],
    queryFn: () => apiClient.get(`/programs/${activeEnrollment.program_id}`).then((r) => r.data),
    enabled: !!activeEnrollment,
  })

  if (loadingEnrollments || loadingProgram) return <Spinner />

  if (!activeEnrollment) {
    return <Card className="p-10 text-center text-sm text-slate-500">Enroll in a program to see your week-wise roadmap.</Card>
  }

  const milestones = [...(program?.milestones ?? [])].sort((a, b) => a.week_number - b.week_number || a.order_index - b.order_index)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Timeline</h1>
        <p className="text-sm text-slate-500">{program?.name} — Week {activeEnrollment.current_week} of {program?.duration_weeks}</p>
      </div>

      <Card className="p-5">
        <ol className="relative space-y-6 border-l border-slate-200 pl-6">
          {milestones.map((m) => (
            <li key={m.id} className="relative">
              <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900">Week {m.week_number}: {m.title}</p>
                <Badge color={TYPE_COLOR[m.milestone_type] ?? 'slate'}>{m.milestone_type.replace('_', ' ')}</Badge>
              </div>
              {m.phase && <p className="text-xs text-slate-400">{m.phase === 'phase1' ? 'Phase 1 · Learning' : 'Phase 2 · Industry Internship'}</p>}
              {m.description && <p className="mt-1 text-xs text-slate-500">{m.description}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
