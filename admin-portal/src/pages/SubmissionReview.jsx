import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'

export default function SubmissionReview() {
  const { kind, submissionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const [score, setScore] = useState('')
  const [passed, setPassed] = useState(true)
  const [feedback, setFeedback] = useState('')

  const detailUrl = kind === 'coding_assignment'
    ? `/coding-assignments/submissions/${submissionId}`
    : `/projects/submissions/${submissionId}`
  const { data: detail, isLoading } = useQuery({
    queryKey: ['submission-detail', kind, submissionId],
    queryFn: () => apiClient.get(detailUrl).then((r) => r.data),
  })

  const goBack = () => navigate(location.state?.from || '/evaluations')

  const gradeMutation = useMutation({
    mutationFn: (extra) => {
      if (kind === 'coding_assignment') {
        return apiClient.put(`/coding-assignments/submissions/${submissionId}/grade`, {
          problems_correct: score ? Number(score) : null,
          passed,
          admin_feedback: feedback,
          ...extra,
        })
      }
      return apiClient.put(`/projects/submissions/${submissionId}/grade`, {
        grade: score ? Number(score) : null,
        feedback,
        status: 'graded',
        ...extra,
      })
    },
    onSuccess: () => {
      push('Saved!', 'success')
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      goBack()
    },
    onError: () => push('Failed to save', 'error'),
  })

  const downloadCodingFile = async (file) => {
    try {
      const res = await apiClient.get(`/coding-assignments/submissions/${submissionId}/files/${file.id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.file_name
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      push('Download failed', 'error')
    }
  }

  const downloadProjectFile = async () => {
    try {
      const res = await apiClient.get(`/projects/submissions/${submissionId}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = detail?.submission_file_name || 'submission'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      push('Download failed', 'error')
    }
  }

  if (isLoading) return <Spinner />
  if (!detail) return <p className="text-sm text-slate-500">Submission not found.</p>

  const isCoding = kind === 'coding_assignment'
  const attemptsRemain = detail.max_attempts != null && detail.attempt_number < detail.max_attempts
  const alreadyClosed = detail.admin_marked_status === 'closed'
  const alreadyRetake = detail.admin_marked_status === 'retake'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={goBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to {location.state?.from === '/platinum-evaluations' ? 'Platinum Evaluations' : 'Evaluations'}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{isCoding ? detail.coding_assignment_title : detail.project_title}</h1>
          <p className="text-sm text-slate-500">Student: {detail.student_full_name}</p>
        </div>
        {alreadyClosed && <Badge color="green">Passed & Closed</Badge>}
        {alreadyRetake && <Badge color="yellow">Retake Granted</Badge>}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Submitted Work</h2>
        {isCoding ? (
          <div className="space-y-5">
            {detail.time_limit_minutes && (
              <p className="text-xs text-slate-500">
                Started {new Date(detail.started_at).toLocaleString()} · {detail.time_limit_minutes} minute time limit
                {detail.submitted_at && ` · submitted ${new Date(detail.submitted_at).toLocaleString()}`}
              </p>
            )}
            {detail.files?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Uploaded Files</p>
                {detail.files.map((f) => (
                  <Button key={f.id} variant="secondary" onClick={() => downloadCodingFile(f)}>Download {f.file_name}</Button>
                ))}
              </div>
            ) : null}
            {detail.answers?.length ? (
              detail.answers.map((a) => (
                <div key={a.problem_id}>
                  <p className="text-sm font-semibold text-slate-900">{a.problem_number}. {a.problem_title}</p>
                  <p className="text-xs text-slate-500">{a.problem_statement}</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-sm text-slate-700">{a.code_text || '(no answer submitted)'}</pre>
                </div>
              ))
            ) : !detail.files?.length ? (
              <p className="text-sm text-slate-500">No answers found for this submission.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {detail.repo_link && (
              <p><span className="font-medium text-slate-700">Repo link: </span><a href={detail.repo_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all">{detail.repo_link}</a></p>
            )}
            {detail.description && <p><span className="font-medium text-slate-700">Description: </span>{detail.description}</p>}
            {detail.submission_file_name ? (
              <Button variant="secondary" onClick={downloadProjectFile}>Download {detail.submission_file_name}</Button>
            ) : (
              <p className="text-slate-500">No file attached.</p>
            )}
            {!detail.repo_link && !detail.description && !detail.submission_file_name && (
              <p className="text-slate-500">Nothing submitted besides the base entry.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Grade</h2>
        <Input label={isCoding ? 'Problems Correct' : 'Grade (0-100)'} type="number" value={score} onChange={(e) => setScore(e.target.value)} />
        {isCoding && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={passed} onChange={(e) => setPassed(e.target.checked)} /> Passed
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Remarks</span>
          <textarea className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Add remarks for this student…" />
        </label>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          {isCoding && passed ? (
            <Button onClick={() => gradeMutation.mutate({ admin_marked_status: 'closed' })} disabled={gradeMutation.isPending}>
              Mark Passed &amp; Close
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => gradeMutation.mutate({})} disabled={gradeMutation.isPending}>
                Save Grade
              </Button>
              {!isCoding && (
                <Button onClick={() => gradeMutation.mutate({ admin_marked_status: 'closed' })} disabled={gradeMutation.isPending}>
                  Mark Satisfied &amp; Close
                </Button>
              )}
              {attemptsRemain && !feedback.trim() && (
                <p className="w-full text-xs text-amber-600">Add remarks above before enabling a retake, so the student knows what to fix.</p>
              )}
              {attemptsRemain && (
                <Button onClick={() => gradeMutation.mutate({ admin_marked_status: 'retake' })} disabled={gradeMutation.isPending || !feedback.trim()}>
                  Save &amp; Enable Retake
                </Button>
              )}
            </>
          )}
        </div>
        {!(isCoding && passed) && !attemptsRemain && (
          <p className="text-xs text-slate-500">No attempts remain for this student (max {detail.max_attempts ?? 5}), so retake isn't available.</p>
        )}
      </Card>
    </div>
  )
}
