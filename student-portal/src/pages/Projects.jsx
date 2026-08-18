import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import FilePreview from '../components/ui/FilePreview'
import ProtectedContent from '../components/proctoring/ProtectedContent'
import { Download, Eye, UploadCloud } from 'lucide-react'

const STATUS_COLOR = { in_progress: 'blue', submitted: 'yellow', under_review: 'blue', graded: 'green', revision_requested: 'red' }
const MAX_ATTEMPTS = 5

export default function Projects() {
  const navigate = useNavigate()
  const { push } = useToast()
  const [viewingProblem, setViewingProblem] = useState(null) // project object

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then((r) => r.data),
  })
  const { data: mySubmissions } = useQuery({
    queryKey: ['project-submissions', 'me'],
    queryFn: () => apiClient.get('/projects/submissions/me').then((r) => r.data),
  })

  if (isLoading) return <Spinner />

  const submissionFor = (projectId) => mySubmissions?.find((s) => s.project_id === projectId)

  const downloadResource = async (projectId, filename) => {
    try {
      const res = await apiClient.get(`/projects/${projectId}/resource/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'resource.zip'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      push('Download failed', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
        <p className="text-sm text-slate-500">Projects uploaded by your administrator.</p>
      </div>

      {projects?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const sub = submissionFor(p.id)
            const isClosed = sub?.admin_marked_status === 'closed'
            const retakeGranted = sub?.admin_marked_status === 'retake'
            const inProgress = sub?.status === 'in_progress'
            const attemptsUsed = sub?.attempt_number ?? 0
            const awaitingGrading = sub && sub.status !== 'graded' && sub.status !== 'in_progress' && !retakeGranted
            const maxedOut = attemptsUsed >= MAX_ATTEMPTS && !retakeGranted && !inProgress
            const canOpen = !sub || inProgress || (!isClosed && !awaitingGrading && !maxedOut)
            return (
              <Card key={p.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{p.title}</p>
                  {isClosed ? <Badge color="green">Passed</Badge> : sub && <Badge color={STATUS_COLOR[sub.status]}>{sub.status.replace('_', ' ')}</Badge>}
                </div>
                <p className="text-xs uppercase text-slate-400">{p.project_type.replace('_', ' ')}</p>
                {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                {sub && <p className="text-xs text-slate-500">{attemptsUsed}/{MAX_ATTEMPTS} attempts used</p>}
                {sub?.grade != null && <p className="text-xs text-emerald-600">Grade: {sub.grade}</p>}
                {sub?.feedback && <p className="text-xs text-slate-500">Admin remarks: {sub.feedback}</p>}
                {retakeGranted && !isClosed && (
                  <p className="text-xs text-emerald-600">Your admin has granted you a retake — you can submit again.</p>
                )}

                <div className="mt-2 flex flex-col gap-2">
                  {p.instructions_file_name && (
                    <Button variant="ghost" onClick={() => setViewingProblem(p)}>
                      <Eye size={15} /> View Problem
                    </Button>
                  )}
                  {p.has_resource && (
                    <Button variant="ghost" onClick={() => downloadResource(p.id, p.resource_file_name)}>
                      <Download size={15} /> Download Supporting Resource
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="mt-auto"
                    disabled={!canOpen}
                    onClick={() => navigate(`/projects/${p.id}/attempt`)}
                  >
                    <UploadCloud size={15} />
                    {isClosed ? 'Completed' : maxedOut ? 'Max attempts reached' : awaitingGrading ? 'Awaiting grading' : inProgress ? 'Resume' : retakeGranted ? 'Retake & Submit' : 'Submit Project File'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">Your administrator has not assigned any project to you yet. It will appear here after the project question and your supporting file are uploaded.</Card>
      )}

      {viewingProblem && (
        <ProtectedContent
          key={viewingProblem.id}
          assessmentType="project"
          assessmentId={viewingProblem.id}
          resourceId={viewingProblem.id}
          viewLabel="View Problem"
          onCancel={() => setViewingProblem(null)}
          autoEnter
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{viewingProblem.title} — Problem</h2>
          <FilePreview
            fetcher={() => apiClient.get(`/projects/${viewingProblem.id}/instructions/download`, { responseType: 'blob' })}
            fileName={viewingProblem.instructions_file_name}
          />
        </ProtectedContent>
      )}
    </div>
  )
}
