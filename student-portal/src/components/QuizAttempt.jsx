import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ProtectedContent from './proctoring/ProtectedContent'

export default function QuizAttempt({ attempt, onFinished }) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(attempt.time_limit_minutes * 60)
  const { push } = useToast()
  const submittedRef = useRef(false)

  const submit = async (auto = false) => {
    if (submittedRef.current) return
    submittedRef.current = true
    try {
      const payload = { answers: Object.entries(answers).map(([question_id, selected_option]) => ({ question_id: Number(question_id), selected_option })) }
      const { data } = await apiClient.post(`/quizzes/attempts/${attempt.attempt_id}/submit`, payload)
      setResult(data)
      if (auto) push('Time is up — quiz auto-submitted.', 'info')
    } catch (err) {
      push(err.response?.data?.detail || 'Submission failed', 'error')
      submittedRef.current = false
    }
  }

  useEffect(() => {
    if (result) return undefined
    if (secondsLeft <= 0) {
      submit(true)
      return undefined
    }
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, result])

  if (result) {
    return <Card className="mx-auto max-w-md p-8 text-center"><h2 className="text-lg font-semibold text-slate-900">{result.passed ? 'You Passed! 🎉' : 'Not Passed'}</h2><p className="mt-2 text-3xl font-bold text-brand-700">{result.score_percent}%</p><p className="mt-1 text-sm text-slate-500">{result.correct_answers} / {result.total_questions} correct</p><Button className="mt-6" onClick={onFinished}>Back to Quizzes</Button></Card>
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <ProtectedContent assessmentType="quiz" assessmentId={attempt.quiz_id} attemptId={attempt.attempt_id} onCancel={onFinished}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
        <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Protected assessment</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Quiz in progress</h1><p className="mt-1 text-sm text-slate-500">{attempt.questions.length} questions · {Object.keys(answers).length} answered</p></div>
          <span className={`rounded-xl px-5 py-3 text-3xl font-extrabold tabular-nums shadow-md ${secondsLeft <= 300 ? 'timer-blink bg-red-600 text-white' : 'bg-yellow-400 text-yellow-950'}`}>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
        </header>

        <div className="space-y-4">
          {attempt.questions.map((question, index) => (
            <Card key={question.id} className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</span><p className="pt-0.5 text-base font-semibold leading-6 text-slate-900">{question.question_text}</p></div>
              <div className="mt-4 space-y-2">
                {['A', 'B', 'C', 'D'].map((letter) => {
                  const selected = answers[question.id] === letter
                  return <label key={letter} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 transition hover:border-brand-300 hover:bg-brand-50 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:font-semibold"><input className="sr-only" type="radio" name={`q-${question.id}`} value={letter} checked={selected} onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: letter }))} />{selected ? <CheckCircle2 size={19} className="shrink-0 text-brand-600" /> : <Circle size={19} className="shrink-0 text-slate-400" />}<span className="w-6 shrink-0 font-bold text-brand-700">{letter}.</span>{question[`option_${letter.toLowerCase()}`]}</label>
                })}
              </div>
            </Card>
          ))}
        </div>

        <div className="sticky bottom-4 z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><Button className="w-full" onClick={() => submit(false)}>Submit Quiz</Button></div>
      </div>
    </ProtectedContent>
  )
}
