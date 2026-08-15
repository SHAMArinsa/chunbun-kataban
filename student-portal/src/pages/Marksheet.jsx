import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'

const TYPE_LABEL = { quiz: 'Quiz', coding_assignment: 'Coding Assignment', project: 'Project', performance: 'Performance', mock_interview: 'Mock Interview' }
const TYPE_COLOR = { quiz: 'blue', coding_assignment: 'blue', project: 'blue', performance: 'slate', mock_interview: 'slate' }

export default function Marksheet() {
  const { data: evaluations, isLoading: loadingEvals } = useQuery({
    queryKey: ['evaluations', 'me'],
    queryFn: () => apiClient.get('/evaluations/me').then((r) => r.data),
  })
  const { data: quizzes, isLoading: loadingQuizzes } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => apiClient.get('/quizzes').then((r) => r.data),
  })
  const { data: quizAttempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ['quiz-attempts', 'me'],
    queryFn: () => apiClient.get('/quizzes/attempts/me').then((r) => r.data),
  })

  if (loadingEvals || loadingQuizzes || loadingAttempts) return <Spinner />

  const quizTitle = (quizId) => quizzes?.find((q) => q.id === quizId)?.title ?? 'Quiz'

  const rows = [
    ...(evaluations ?? []).map((e) => ({
      id: `eval-${e.id}`,
      type: e.evaluation_type,
      item: e.reference_title ?? '—',
      score: e.score != null ? `${e.score}/${e.max_score ?? '—'}` : '—',
      remarks: e.feedback || '',
      date: e.evaluated_at,
    })),
    ...(quizAttempts ?? [])
      .filter((a) => a.status !== 'in_progress')
      .map((a) => ({
        id: `quiz-${a.id}`,
        type: 'quiz',
        item: quizTitle(a.quiz_id),
        score: a.score_percent != null ? `${a.score_percent}%` : '—',
        remarks: a.passed == null ? '' : a.passed ? 'Passed' : 'Not passed',
        date: a.submitted_at,
      })),
  ].sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))

  const columns = [
    { key: 'type', header: 'Type', render: (r) => <Badge color={TYPE_COLOR[r.type] ?? 'slate'}>{TYPE_LABEL[r.type] ?? r.type}</Badge> },
    { key: 'item', header: 'Item' },
    { key: 'score', header: 'Score', render: (r) => <span className="font-medium text-slate-900">{r.score}</span> },
    { key: 'remarks', header: 'Remarks', render: (r) => r.remarks || <span className="text-slate-400">—</span> },
    { key: 'date', header: 'Date', render: (r) => (r.date ? new Date(r.date).toLocaleString() : '—') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Marksheet</h1>
        <p className="text-sm text-slate-500">All your scores and admin remarks in one place — quizzes, coding assignments, and projects.</p>
      </div>
      <Card><Table columns={columns} rows={rows} emptyMessage="No graded work yet." /></Card>
    </div>
  )
}
