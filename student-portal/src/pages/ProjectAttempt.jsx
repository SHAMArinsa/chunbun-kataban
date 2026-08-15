import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import FileUpload from '../components/ui/FileUpload'

export default function ProjectAttempt() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const [attempt, setAttempt] = useState(null)
  const [repoLink, setRepoLink] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [started, setStarted] = useState(false)
  const startRequested = useRef(false)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}`).then((r) => r.data),
  })

  const startMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/start`).then((r) => r.data),
    onSuccess: (data) => {
      setAttempt(data)
      setStarted(true)
    },
    onError: (err) => {
      push(err.response?.data?.detail || 'Could not start this project', 'error')
      navigate('/projects')
    },
  })

  useEffect(() => {
    if (!project || startRequested.current) return
    startRequested.current = true
    startMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  const submitMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData()
      formData.append('repo_link', repoLink)
      formData.append('description', description)
      formData.append('file', file)
      return apiClient.post(`/projects/submissions/${attempt.submission_id}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      push('Submitted for review!', 'success')
      queryClient.invalidateQueries({ queryKey: ['project-submissions'] })
      navigate('/projects')
    },
    onError: (err) => push(err.response?.data?.detail || 'Submission failed', 'error'),
  })

  if (projectLoading || !started) return <Spinner />

  const hasAllAnswers = !!(repoLink.trim() && description.trim() && file)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to Projects
      </button>

      <h1 className="text-2xl font-semibold text-slate-900">{project?.title}</h1>

      <Card className="space-y-2 p-6">
        <p className="text-xs uppercase text-slate-400">{project?.project_type?.replace('_', ' ')}</p>
        {project?.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{project.description}</p>}
        <p className="text-xs text-slate-400">
          Need the full problem statement or supporting resource again? Use "View Problem" / "Download Supporting
          Resource" on the Projects list.
        </p>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-sm font-semibold text-slate-900">Submit Your Deliverable</h2>
        <Input label="GitHub / Repo Link" value={repoLink} onChange={(e) => setRepoLink(e.target.value)} placeholder="https://github.com/…" />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <textarea className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <FileUpload
          label="Project Files (.zip)"
          accept=".zip"
          onChange={setFile}
          fileName={file?.name}
          hint="Bundle all your project files into a single ZIP archive"
        />
        <p className="text-xs text-slate-500">Repo link, description, and a ZIP file are all required to submit.</p>
        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !hasAllAnswers} className="w-full">
          Submit
        </Button>
      </Card>
    </div>
  )
}

