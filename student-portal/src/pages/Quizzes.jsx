import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import QuizAttempt from '../components/QuizAttempt'

export default function Quizzes() {
  const [activeAttempt, setActiveAttempt] = useState(null)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => apiClient.get('/quizzes').then((r) => r.data),
  })
  const { data: attempts } = useQuery({
    queryKey: ['quiz-attempts', 'me'],
    queryFn: () => apiClient.get('/quizzes/attempts/me').then((r) => r.data),
  })

  const startMutation = useMutation({
    mutationFn: (quizId) => apiClient.post(`/quizzes/${quizId}/start`).then((r) => r.data),
    onSuccess: (data) => setActiveAttempt(data),
    onError: (err) => push(err.response?.data?.detail || 'Could not start quiz', 'error'),
  })

  const handleFinished = () => {
    setActiveAttempt(null)
    queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] })
  }

  if (isLoading) return <Spinner />

  if (activeAttempt) {
    return <QuizAttempt attempt={activeAttempt} onFinished={handleFinished} />
  }

  const attemptsFor = (quizId) => attempts?.filter((a) => a.quiz_id === quizId) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Quizzes</h1>
        <p className="text-sm text-slate-500">MCQ assessments with timed, limited attempts.</p>
      </div>

      {quizzes?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => {
            const used = attemptsFor(q.id)
            const bestPass = used.some((a) => a.passed)
            const exhausted = used.length >= q.max_attempts
            return (
              <Card key={q.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{q.title}</p>
                  {bestPass && <Badge color="green">Passed</Badge>}
                </div>
                <p className="text-xs text-slate-500">
                  {q.questions_per_attempt} questions · {q.passing_percent}% to pass · {q.time_limit_minutes} min
                </p>
                <p className="text-xs text-slate-400">{used.length}/{q.max_attempts} attempts used ({q.attempts_per_day}/day)</p>
                <Button disabled={exhausted || startMutation.isPending} onClick={() => startMutation.mutate(q.id)}>
                  {exhausted ? 'Max attempts reached' : used.length ? 'Retake Quiz' : 'Start Quiz'}
                </Button>
                {used.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                    <p className="text-xs font-medium text-slate-500">Attempt history</p>
                    {[...used].reverse().map((a, i) => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Attempt {used.length - i}
                          {a.submitted_at && ` · ${new Date(a.submitted_at).toLocaleDateString()}`}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700">{a.score_percent != null ? `${a.score_percent}%` : '—'}</span>
                          {a.passed != null && <Badge color={a.passed ? 'green' : 'red'}>{a.passed ? 'Pass' : 'Fail'}</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">No quizzes available yet.</Card>
      )}
    </div>
  )
}
