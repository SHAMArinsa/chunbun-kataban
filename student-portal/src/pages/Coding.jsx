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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              <Card key={a.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  {isClosed ? <Badge color="green">Passed</Badge> : latest && <Badge color={STATUS_COLOR[latest.status]}>{latest.status.replace('_', ' ')}</Badge>}
                </div>
                <p className="text-xs text-slate-500">
                  {a.problems?.length ?? 0}/{a.num_problems} problems · {a.required_correct} correct required · {subs.length}/{a.max_attempts} attempts used
                </p>
                {latest?.admin_feedback && (
                  <p className="text-xs text-slate-500">Admin remarks: {latest.admin_feedback}</p>
                )}
                {retakeGranted && !isClosed && (
                  <p className="text-xs text-emerald-600">Your admin has granted you a retake — you can submit again.</p>
                )}
                <Button
                  variant="secondary"
                  className="mt-2"
                  disabled={isClosed || awaitingGrading || maxedOut || noProblemsYet}
                  onClick={() => navigate(`/coding/${a.id}/attempt`)}
                >
                  {isClosed ? 'Completed' : maxedOut ? 'Max attempts reached' : awaitingGrading ? 'Awaiting grading' : noProblemsYet ? 'No problems assigned yet' : inProgress ? 'Resume' : retakeGranted ? 'Retake & Submit' : 'View & Submit'}
                </Button>
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
