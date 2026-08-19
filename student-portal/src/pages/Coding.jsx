import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

const STATUS_COLOR = { in_progress: 'blue', submitted: 'yellow', under_review: 'blue', graded: 'green' }

export default function Coding() {
  const navigate = useNavigate()

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['coding-assignments'],
    queryFn: () => apiClient.get('/coding-assignments').then((r) => r.data),
  })
  const { data: mySubmissions } = useQuery({
    queryKey: ['coding-submissions', 'me'],
    queryFn: () => apiClient.get('/coding-assignments/submissions/me').then((r) => r.data),
  })

  if (isLoading) return <Spinner />

  const submissionsFor = (assignmentId) => mySubmissions?.filter((s) => s.coding_assignment_id === assignmentId) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Coding Work</h1>
        <p className="text-sm text-slate-500">View coding problems and submit your solutions.</p>
      </div>

      {assignments?.length ? (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subs = submissionsFor(a.id)
            const latest = subs[0]
            const noProblemsYet = !a.problems?.length
            const isClosed = subs.some((s) => s.admin_marked_status === 'closed')
            const retakeGranted = latest?.admin_marked_status === 'retake'
            const inProgress = latest?.status === 'in_progress'
            const awaitingGrading = latest && !inProgress && !retakeGranted
            const maxedOut = subs.length >= a.max_attempts && !retakeGranted && !inProgress
            return (
              <Card key={a.id} className="rounded-2xl border-brand-100 bg-gradient-to-r from-white via-white to-brand-50/50 p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-brand-800">{a.title}</p>
                  {isClosed ? <Badge color="green">Passed</Badge> : latest && <Badge color={STATUS_COLOR[latest.status]}>{latest.status.replace('_', ' ')}</Badge>}
                    </div>
                    <p className="text-base text-slate-600">{a.problems?.length ?? 0}/{a.num_problems} problems · {a.required_correct} correct required · {subs.length}/{a.max_attempts} attempts used</p>
                    {latest?.admin_feedback && <p className="text-sm text-slate-600">Admin remarks: {latest.admin_feedback}</p>}
                    {retakeGranted && !isClosed && <p className="text-sm font-semibold text-emerald-600">Your admin has granted you a retake — you can submit again.</p>}
                  </div>
                  <Button variant="secondary" className="shrink-0 !px-5 !py-3 !text-base" disabled={isClosed || awaitingGrading || maxedOut || noProblemsYet} onClick={() => navigate(`/coding/${a.id}/attempt`)}>
                    {isClosed ? 'Completed' : maxedOut ? 'Max attempts reached' : awaitingGrading ? 'Awaiting grading' : noProblemsYet ? 'No problems assigned yet' : inProgress ? 'Resume' : retakeGranted ? 'Retake & Submit' : 'View & Submit'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">Your administrator has not assigned any coding work to you yet. It will appear here after your question file is uploaded and assigned.</Card>
      )}
    </div>
  )
}
