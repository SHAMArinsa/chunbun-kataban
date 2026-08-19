import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
import { Award, BarChart3, ClipboardCheck, TrendingUp } from 'lucide-react'
import './AcademicProgress.css'

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

  const percentageScores = rows.flatMap((row) => {
    if (row.type === 'quiz') return row.score === '—' ? [] : [Number.parseFloat(row.score)]
    const [score, maximum] = row.score.split('/').map(Number)
    return Number.isFinite(score) && Number.isFinite(maximum) && maximum > 0 ? [(score / maximum) * 100] : []
  })
  const averageScore = percentageScores.length
    ? Math.round(percentageScores.reduce((total, score) => total + score, 0) / percentageScores.length)
    : null
  const passedCount = rows.filter((row) => row.remarks === 'Passed').length

  return (
    <div className="academic-page">
      <section className="academic-hero">
        <div>
          <p className="academic-kicker">ACADEMIC RECORD</p>
          <h1>Marksheet</h1>
          <p>Track every quiz, project, coding assignment, and evaluator remark in one place.</p>
        </div>
        <Award aria-hidden="true" />
      </section>

      <section className="marksheet-summary" aria-label="Marksheet summary">
        <article>
          <span><ClipboardCheck size={20} /></span>
          <div><p>Recorded results</p><strong>{rows.length}</strong></div>
        </article>
        <article>
          <span><TrendingUp size={20} /></span>
          <div><p>Average score</p><strong>{averageScore == null ? '—' : `${averageScore}%`}</strong></div>
        </article>
        <article>
          <span><BarChart3 size={20} /></span>
          <div><p>Quizzes passed</p><strong>{passedCount}</strong></div>
        </article>
      </section>

      <section className="marksheet-results">
        <div className="academic-section-heading">
          <div>
            <p>YOUR RESULTS</p>
            <h2>Performance history</h2>
          </div>
          <span>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        <Card className="marksheet-table-card"><Table columns={columns} rows={rows} emptyMessage="No graded work yet." /></Card>
      </section>
    </div>
  )
}
