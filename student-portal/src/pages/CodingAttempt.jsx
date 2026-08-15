import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Eye } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import FileUpload from '../components/ui/FileUpload'
import FilePreview from '../components/ui/FilePreview'
import ProtectedContent from '../components/proctoring/ProtectedContent'

export default function CodingAttempt() {
  const { codingId } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const [attempt, setAttempt] = useState(null)
  const [files, setFiles] = useState([])
  const [started, setStarted] = useState(false)
  const [previewingQuestion, setPreviewingQuestion] = useState(false)
  const startRequested = useRef(false)

  const { data: coding, isLoading: codingLoading } = useQuery({
    queryKey: ['coding-assignment', codingId],
    queryFn: () => apiClient.get(`/coding-assignments/${codingId}`).then((r) => r.data),
  })

  const startMutation = useMutation({
    mutationFn: () => apiClient.post(`/coding-assignments/${codingId}/start`).then((r) => r.data),
    onSuccess: (data) => {
      setAttempt(data)
      setStarted(true)
    },
    onError: (err) => {
      push(err.response?.data?.detail || 'Could not start this assignment', 'error')
      navigate('/coding')
    },
  })

  useEffect(() => {
    if (!coding || startRequested.current) return
    startRequested.current = true
    startMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coding])

  const submitMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      return apiClient.post(`/coding-assignments/submissions/${attempt.submission_id}/submit-files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      push('Submitted for review!', 'success')
      queryClient.invalidateQueries({ queryKey: ['coding-submissions'] })
      navigate('/coding')
    },
    onError: (err) => {
      push(err.response?.data?.detail || 'Submission failed', 'error')
      queryClient.invalidateQueries({ queryKey: ['coding-submissions'] })
    },
  })

  const downloadResource = async () => {
    const response = await apiClient.get(`/coding-assignments/${codingId}/resource/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url; link.download = coding.resource_file_name || 'supporting-file'; link.click(); URL.revokeObjectURL(url)
  }

  if (codingLoading || !started) return <Spinner />

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/coding')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to Coding Work
      </button>

      <h1 className="text-2xl font-semibold text-slate-900">{coding?.title}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="space-y-3 p-6">
            <h2 className="text-sm font-semibold text-slate-900">Question</h2>
            <p className="text-sm text-slate-500">Open the protected question preview when you are ready.</p>
            <Button variant="secondary" onClick={() => setPreviewingQuestion(true)}>
              <Eye size={15} /> Preview Question
            </Button>
            {coding.has_resource && <Button variant="ghost" onClick={downloadResource}><Download size={15} /> Download Supporting File</Button>}
          </Card>

          {previewingQuestion && (
            <ProtectedContent
              assessmentType="coding_assignment"
              assessmentId={Number(codingId)}
              attemptId={attempt?.submission_id}
              onCancel={() => setPreviewingQuestion(false)}
            >
        <Card className="space-y-3 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Question</h2>
          {coding?.question_files?.length > 0 ? (
            <div className="space-y-5">
              {coding.question_files.map((f) => (
                <div key={f.sheet_id}>
                  {coding.question_files.length > 1 && (
                    <p className="mb-2 text-xs font-medium text-slate-500">{f.file_name}</p>
                  )}
                  <FilePreview
                    fetcher={() => apiClient.get(`/coding-assignments/sheets/${f.sheet_id}/download`, { responseType: 'blob' })}
                    fileName={f.file_name}
                  />
                </div>
              ))}
            </div>
          ) : coding?.problems?.length ? (
            <div className="max-h-[65vh] select-none space-y-5 overflow-y-auto">
              {coding.problems.map((p) => (
                <div key={p.id}>
                  <p className="text-sm font-semibold text-slate-900">{p.problem_number}. {p.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{p.statement}</p>
                  {p.sample_input && (
                    <p className="mt-2 text-xs text-slate-400">Sample: {p.sample_input} → {p.sample_output}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No question has been assigned to you yet.</p>
          )}
        </Card>
            </ProtectedContent>
          )}
        </div>

        <Card className="h-fit space-y-3 p-6 lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-slate-900">Upload Your Answer</h2>
          <FileUpload
            label="Upload your answer"
            accept=".docx,.xlsx,.zip,.rar,.pdf,.jpg,.jpeg,.png"
            multiple
            onChange={setFiles}
            fileName={files.length ? `${files.length} file(s) selected` : ''}
            hint="DOCX, XLSX, ZIP, RAR, PDF, JPG, JPEG, or PNG"
          />
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !files.length} className="w-full">
            Submit
          </Button>
        </Card>
      </div>
    </div>
  )
}
