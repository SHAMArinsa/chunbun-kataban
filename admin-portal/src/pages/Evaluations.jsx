import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

function RemarksModal({ evaluation, onClose }) {
  const [feedback, setFeedback] = useState(evaluation.feedback ?? '')
  const { push } = useToast()
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: () => apiClient.put(`/evaluations/${evaluation.id}/remarks`, { feedback }),
    onSuccess: () => {
      push('Remarks saved!', 'success')
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      onClose()
    },
    onError: () => push('Failed to save remarks', 'error'),
  })

  return (
    <Modal open onClose={onClose} title={`Remarks: ${evaluation.student_full_name}`} footer={<Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save Remarks</Button>}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          {KIND_LABEL[evaluation.evaluation_type] ?? evaluation.evaluation_type.replace('_', ' ')}
          {evaluation.reference_title ? ` — ${evaluation.reference_title}` : ''}
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Remarks</span>
          <textarea className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Add remarks for this student…" />
        </label>
      </div>
    </Modal>
  )
}

const KIND_LABEL = { coding_assignment: 'Coding Assignment', project: 'Project' }

function downloadProjectFile(submissionId, fileName) {
  return apiClient
    .get(`/projects/submissions/${submissionId}/download`, { responseType: 'blob' })
    .then((res) => {
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'submission'
      a.click()
      window.URL.revokeObjectURL(url)
    })
}

export default function Evaluations({ platinumOnly = false }) {
  const navigate = useNavigate()
  const [editingRemarks, setEditingRemarks] = useState(null)
  const [search, setSearch] = useState('')
  const { data: pending, isLoading } = useQuery({
    queryKey: ['evaluations', 'pending', search],
    queryFn: () => apiClient.get('/evaluations/pending', { params: search ? { search } : {} }).then((r) => r.data),
  })
  const { data: history } = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => apiClient.get('/evaluations').then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  if (isLoading) return <Spinner />

  const platinumProgram = programs?.find((p) => p.code === 'platinum')
  const belongsToTab = (programId) => (platinumOnly ? programId === platinumProgram?.id : programId !== platinumProgram?.id)
  const visiblePending = pending?.filter((p) => belongsToTab(p.program_id))
  const visibleHistory = history?.filter((h) => belongsToTab(h.program_id))
  const backTo = platinumOnly ? '/platinum-evaluations' : '/evaluations'

  const pendingColumns = [
    { key: 'kind', header: 'Type', render: (r) => <Badge color="blue">{KIND_LABEL[r.kind]}</Badge> },
    { key: 'student_id', header: 'Student ID' },
    { key: 'student_full_name', header: 'Student' },
    { key: 'tier', header: 'Tier', render: (r) => <span className="capitalize">{r.tier ?? '—'}</span> },
    { key: 'title', header: 'Title' },
    {
      key: 'file',
      header: 'Submitted File',
      render: (r) =>
        r.kind === 'project' && r.file_name ? (
          <button className="text-brand-600 hover:underline" onClick={() => downloadProjectFile(r.submission_id, r.file_name)}>
            {r.file_name}
          </button>
        ) : r.kind === 'coding_assignment' ? (
          <span className="text-slate-500">Code (text)</span>
        ) : (
          <span className="text-slate-400">No file</span>
        ),
    },
    { key: 'submitted_at', header: 'Submitted', render: (r) => new Date(r.submitted_at).toLocaleString() },
    { key: 'action', header: '', render: (r) => <Button onClick={() => navigate(`/evaluations/review/${r.kind}/${r.submission_id}`, { state: { from: backTo } })}>Review & Grade</Button> },
  ]

  const historyColumns = [
    { key: 'evaluation_type', header: 'Type', render: (r) => <Badge color="green">{r.evaluation_type.replace('_', ' ')}</Badge> },
    { key: 'reference_title', header: 'Item', render: (r) => r.reference_title ?? '—' },
    { key: 'student_id', header: 'Student ID' },
    { key: 'student_full_name', header: 'Student' },
    { key: 'tier', header: 'Tier', render: (r) => <span className="capitalize">{r.tier ?? '—'}</span> },
    { key: 'score', header: 'Score', render: (r) => (r.score != null ? `${r.score}/${r.max_score ?? '—'}` : '—') },
    { key: 'evaluated_at', header: 'Evaluated', render: (r) => new Date(r.evaluated_at).toLocaleString() },
    {
      key: 'feedback',
      header: 'Remarks',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="max-w-xs truncate text-slate-600">{r.feedback || <span className="text-slate-400">No remarks yet</span>}</span>
          <button className="shrink-0 text-xs text-brand-600 hover:underline" onClick={() => setEditingRemarks(r)}>
            {r.feedback ? 'Edit' : 'Add'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">{platinumOnly ? 'Platinum Evaluations' : 'Evaluations'}</h1>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Pending Review ({visiblePending?.length ?? 0})</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name or ID…"
            className="w-72 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <Card>
          <Table
            columns={pendingColumns}
            rows={visiblePending?.map((p) => ({ ...p, id: `${p.kind}-${p.submission_id}` }))}
            emptyMessage="Nothing pending review."
            rowClassName={(r) => (!r.is_read ? 'bg-amber-50' : '')}
          />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Graded History</h2>
        <Card><Table columns={historyColumns} rows={visibleHistory} emptyMessage="No graded evaluations yet." /></Card>
      </div>

      {editingRemarks && <RemarksModal evaluation={editingRemarks} onClose={() => setEditingRemarks(null)} />}
    </div>
  )
}
