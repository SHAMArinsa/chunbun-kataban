import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Download, SlidersHorizontal, ArrowUp, ArrowDown, FileText, FolderInput, Trash2, Upload } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'

const PAGE_SIZE = 25

const ENROLLMENT_STATUSES = ['pending_payment', 'active', 'completed', 'dropped', 'suspended']
const ASSESSMENT_STATUSES = ['not_assigned', 'assigned', 'in_progress', 'submitted', 'under_evaluation', 'evaluated', 'passed', 'failed', 'retake_assigned']
const EVALUATION_STATUSES = ['pending', 'evaluated', 'needs_review']
const ATTEMPT_BUCKETS = [
  { value: '3', label: '3+ Attempts Remaining' },
  { value: '2', label: '2 Attempts Remaining' },
  { value: '1', label: '1 Attempt Remaining' },
  { value: '0', label: 'No Attempts Left' },
]

const STATUS_COLOR = {
  not_assigned: 'slate', assigned: 'blue', in_progress: 'blue', submitted: 'blue', under_evaluation: 'yellow',
  evaluated: 'slate', passed: 'green', failed: 'red', retake_assigned: 'yellow',
}
const attemptsColor = (remaining) => (remaining >= 3 ? 'green' : remaining === 2 ? 'blue' : remaining === 1 ? 'yellow' : 'red')

function toCsvValue(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ProjectManage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ internship_status: '', assessment_status: '', attempts_remaining: '', evaluation_status: '', score_min: '', score_max: '' })
  const [sortBy, setSortBy] = useState('full_name')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [bulkAction, setBulkAction] = useState('')

  const problemFileInputRef = useRef(null)
  const resourceFileInputRef = useRef(null)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}`).then((r) => r.data),
  })

  const uploadInstructionsMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.post(`/projects/${projectId}/instructions`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      push('Problem document uploaded.', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Upload failed', 'error'),
  })

  const deleteInstructionsMutation = useMutation({
    mutationFn: () => apiClient.delete(`/projects/${projectId}/instructions`),
    onSuccess: () => {
      push('Problem document removed.', 'success')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Removal failed', 'error'),
  })

  const uploadResourceMutation = useMutation({
    mutationFn: async ({ file, studentIds }) => {
      for (const studentId of studentIds) {
        const formData = new FormData()
        formData.append('file', file)
        await apiClient.post(`/projects/${projectId}/students/${studentId}/resource`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
    },
    onSuccess: (_res, { studentIds }) => {
      push(`Supporting resource uploaded for ${studentIds.length} student(s).`, 'success')
      invalidateRoster()
    },
    onError: (err) => push(err.response?.data?.detail || 'Upload failed', 'error'),
  })

  const rosterParams = {
    search: search || undefined,
    internship_status: filters.internship_status || undefined,
    assessment_status: filters.assessment_status || undefined,
    attempts_remaining: filters.attempts_remaining || undefined,
    evaluation_status: filters.evaluation_status || undefined,
    score_min: filters.score_min || undefined,
    score_max: filters.score_max || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  }
  const { data: roster, isLoading: rosterLoading, refetch } = useQuery({
    queryKey: ['project-roster', projectId, rosterParams],
    queryFn: () => apiClient.get(`/projects/${projectId}/roster`, { params: rosterParams }).then((r) => r.data),
    keepPreviousData: true,
  })

  const rows = roster?.items ?? []
  const total = roster?.total ?? 0

  const invalidateRoster = () => queryClient.invalidateQueries({ queryKey: ['project-roster', projectId] })

  const bulkGradeMutation = useMutation({
    mutationFn: ({ submissionIds, payload }) => Promise.all(submissionIds.map((id) => apiClient.put(`/projects/submissions/${id}/grade`, payload))),
    onSuccess: (_res, { label, count }) => {
      push(`${label} applied to ${count} student(s).`, 'success')
      invalidateRoster()
      setSelectedIds([])
    },
    onError: (err) => push(err.response?.data?.detail || 'Bulk action failed', 'error'),
  })

  if (projectLoading) return <Spinner />

  const selectedRows = rows.filter((r) => selectedIds.includes(r.student_id))
  const selectableIds = rows.filter((r) => !r.locked).map((r) => r.student_id)
  const allPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))
  const toggle = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const togglePage = () => {
    if (allPageSelected) setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)))
    else setSelectedIds((prev) => [...new Set([...prev, ...selectableIds])])
  }

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }
  const sortHeader = (label, col) => (
    <button className="flex items-center gap-1 hover:text-slate-900" onClick={() => toggleSort(col)}>
      {label} {sortBy === col && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  )

  const downloadSubmission = async (r) => {
    if (!r.latest_submission_id) return
    try {
      const res = await apiClient.get(`/projects/submissions/${r.latest_submission_id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = r.submission_file_name || 'submission'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      push('No file attached to this submission (repo link/description only).', 'error')
    }
  }

  const exportCsv = (list) => {
    const headers = ['Student ID', 'Name', 'Email', 'Batch', 'Enrollment Status', 'Assignment Status', 'Attempts Used', 'Max Attempts', 'Attempts Remaining', 'Highest Score', 'Current Score', 'Evaluation Status', 'Assigned Date', 'Submission Date', 'Evaluator', 'Last Updated']
    const lines = list.map((r) => [
      r.student_id, r.full_name, r.email, r.batch ?? '', r.enrollment_status, r.assignment_status,
      r.attempts_used, r.max_attempts, r.attempts_remaining, r.highest_score ?? '', r.current_score ?? '',
      r.evaluation_status, r.assigned_at ?? '', r.submitted_at ?? '', r.evaluator ?? '', r.last_updated ?? '',
    ].map(toCsvValue).join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.title || 'project'}-roster.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const runBulkAction = async () => {
    if (!bulkAction) return
    const withSubmission = selectedRows.filter((r) => r.latest_submission_id)
    const withoutSubmission = selectedRows.length - withSubmission.length

    if (bulkAction === 'assign') {
      navigate(`/projects/${projectId}/assign`)
      setBulkAction('')
      return
    }
    if (bulkAction === 'export_csv') {
      exportCsv(selectedRows.length ? selectedRows : rows)
      setBulkAction('')
      return
    }
    if (bulkAction === 'export_csv_all') {
      const res = await apiClient.get(`/projects/${projectId}/roster`, { params: { ...rosterParams, skip: 0, limit: Math.max(total, 1) } })
      exportCsv(res.data.items)
      setBulkAction('')
      return
    }
    if (bulkAction === 'download_submission') {
      if (!withSubmission.length) push('No selected students have a submission yet.', 'error')
      withSubmission.forEach(downloadSubmission)
      setBulkAction('')
      return
    }

    if (withoutSubmission > 0) {
      push(`${withoutSubmission} selected student(s) haven't submitted yet — skipping those for this action.`, 'error')
    }
    if (!withSubmission.length) { setBulkAction(''); return }

    const submissionIds = withSubmission.map((r) => r.latest_submission_id)
    const actionMap = {
      retake: { payload: { admin_marked_status: 'retake' }, label: 'Retake assigned' },
      lock: { payload: { admin_marked_status: 'closed' }, label: 'Locked' },
      unlock: { payload: { admin_marked_status: null }, label: 'Unlocked' },
      mark_evaluated: { payload: { status: 'graded' }, label: 'Marked evaluation complete' },
    }
    const action = actionMap[bulkAction]
    if (action) bulkGradeMutation.mutate({ submissionIds, payload: action.payload, label: action.label, count: submissionIds.length })
    setBulkAction('')
  }

  const singleRetake = (r) => bulkGradeMutation.mutate({ submissionIds: [r.latest_submission_id], payload: { admin_marked_status: 'retake' }, label: 'Retake assigned', count: 1 })
  const singleLock = (r) => bulkGradeMutation.mutate({ submissionIds: [r.latest_submission_id], payload: { admin_marked_status: 'closed' }, label: 'Locked', count: 1 })
  const singleUnlock = (r) => bulkGradeMutation.mutate({ submissionIds: [r.latest_submission_id], payload: { admin_marked_status: null }, label: 'Unlocked', count: 1 })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to Projects
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{project?.title}</h1>
        <p className="text-sm text-slate-500">{project?.project_type?.replace('_', ' ')} · max 5 attempts · {total} student(s) in program</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Upload Problem</p>
              <p className="text-xs text-slate-500">
                The question document every assigned student sees when they click "View Problem".
              </p>
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {project?.instructions_file_name || 'No problem document uploaded yet — students will see nothing to view.'}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={problemFileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.zip,.rar,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadInstructionsMutation.mutate(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="secondary"
              onClick={() => problemFileInputRef.current?.click()}
              disabled={uploadInstructionsMutation.isPending}
            >
              <Upload size={15} /> {project?.instructions_file_name ? 'Replace Problem' : 'Upload Problem'}
            </Button>
            {project?.instructions_file_name && (
              <Button
                variant="danger"
                onClick={() => deleteInstructionsMutation.mutate()}
                disabled={deleteInstructionsMutation.isPending}
              >
                <Trash2 size={15} /> Remove
              </Button>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FolderInput size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Upload Resource</p>
              <p className="text-xs text-slate-500">
                Starter files or reference material (.zip) handed out to specific students — separate from the problem
                document and from what they submit back.
              </p>
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {selectedIds.length
              ? `Will upload to ${selectedIds.length} selected student(s) in the roster below.`
              : 'Select one or more students in the roster below, then upload here.'}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={resourceFileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  if (!selectedIds.length) {
                    push('Select at least one student in the roster first.', 'error')
                  } else {
                    uploadResourceMutation.mutate({ file, studentIds: selectedIds })
                  }
                }
                e.target.value = ''
              }}
            />
            <Button
              variant="secondary"
              onClick={() => resourceFileInputRef.current?.click()}
              disabled={uploadResourceMutation.isPending}
            >
              <Upload size={15} /> Upload Resource
            </Button>
          </div>
        </Card>
      </div>

      <Card className="sticky top-0 z-10 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <Input placeholder="Search by name, email, or student ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
          </div>
          <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={15} /> Filters</Button>
          <Button variant="ghost" onClick={() => refetch()}><RefreshCw size={15} /> Refresh</Button>
          <Button variant="ghost" onClick={() => exportCsv(rows)}><Download size={15} /> Export CSV (page)</Button>
          <Button onClick={() => navigate(`/projects/${projectId}/assign`)}>Assign Project</Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3 lg:grid-cols-6">
            <Select value={filters.internship_status} onChange={(e) => { setFilters((f) => ({ ...f, internship_status: e.target.value })); setPage(0) }}>
              <option value="">Internship Status: All</option>
              {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Select value={filters.assessment_status} onChange={(e) => { setFilters((f) => ({ ...f, assessment_status: e.target.value })); setPage(0) }}>
              <option value="">Assessment Status: All</option>
              {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Select value={filters.attempts_remaining} onChange={(e) => { setFilters((f) => ({ ...f, attempts_remaining: e.target.value })); setPage(0) }}>
              <option value="">Attempts Remaining: All</option>
              {ATTEMPT_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </Select>
            <Select value={filters.evaluation_status} onChange={(e) => { setFilters((f) => ({ ...f, evaluation_status: e.target.value })); setPage(0) }}>
              <option value="">Evaluation Status: All</option>
              {EVALUATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Input type="number" placeholder="Min Score" value={filters.score_min} onChange={(e) => { setFilters((f) => ({ ...f, score_min: e.target.value })); setPage(0) }} />
            <Input type="number" placeholder="Max Score" value={filters.score_max} onChange={(e) => { setFilters((f) => ({ ...f, score_max: e.target.value })); setPage(0) }} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
          <span className="text-sm text-slate-600">{selectedIds.length} selected</span>
          <div className="w-64">
            <Select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option value="">Bulk action…</option>
              <option value="assign">Assign Project</option>
              <option value="retake">Assign Retake</option>
              <option value="lock">Lock Assessment</option>
              <option value="unlock">Unlock Assessment</option>
              <option value="mark_evaluated">Mark Evaluation Complete</option>
              <option value="download_submission">Download Submission(s)</option>
              <option value="export_csv">Export Selected (CSV)</option>
              <option value="export_csv_all">Export Entire Filtered Result (CSV)</option>
            </Select>
          </div>
          <Button variant="secondary" onClick={runBulkAction} disabled={!bulkAction || bulkGradeMutation.isPending}>Apply</Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {rosterLoading ? (
          <div className="p-10"><Spinner /></div>
        ) : (
          <Table
            keyField="student_id"
            rowClassName={(r) => (r.locked ? 'opacity-70' : '')}
            emptyMessage="No students match this search/filter."
            rows={rows}
            columns={[
              {
                key: 'select',
                header: <input type="checkbox" checked={allPageSelected} disabled={!selectableIds.length} onChange={togglePage} />,
                render: (r) => <input type="checkbox" checked={selectedIds.includes(r.student_id)} disabled={r.locked} onChange={() => toggle(r.student_id)} />,
              },
              { key: 'student_id', header: 'ID' },
              { key: 'full_name', header: sortHeader('Name', 'full_name') },
              { key: 'email', header: sortHeader('Email', 'email'), render: (r) => <span className="text-slate-500">{r.email}</span> },
              { key: 'batch', header: 'Batch', render: (r) => r.batch ?? '—' },
              {
                key: 'assignment_status',
                header: sortHeader('Status', 'status'),
                render: (r) => <Badge color={STATUS_COLOR[r.assignment_status] ?? 'slate'}>{r.assignment_status.replace('_', ' ')}</Badge>,
              },
              {
                key: 'attempts',
                header: sortHeader('Attempts', 'attempts_remaining'),
                render: (r) => (
                  <span>
                    {r.attempts_used}/{r.max_attempts} · <Badge color={attemptsColor(r.attempts_remaining)}>{r.attempts_remaining} left</Badge>
                  </span>
                ),
              },
              { key: 'highest_score', header: sortHeader('Highest', 'highest_score'), render: (r) => (r.highest_score != null ? Math.round(r.highest_score) : '—') },
              { key: 'current_score', header: sortHeader('Current', 'current_score'), render: (r) => (r.current_score != null ? Math.round(r.current_score) : '—') },
              { key: 'evaluation_status', header: 'Evaluation', render: (r) => r.evaluation_status.replace('_', ' ') },
              { key: 'submitted_at', header: sortHeader('Submitted', 'submitted_at'), render: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—') },
              { key: 'evaluator', header: sortHeader('Evaluator', 'evaluator'), render: (r) => r.evaluator ?? '—' },
              {
                key: 'actions',
                header: 'Actions',
                render: (r) => (
                  <div className="flex flex-wrap gap-1.5">
                    {r.latest_submission_id && (
                      <button className="text-xs text-brand-600 hover:underline" onClick={() => navigate(`/evaluations/review/project/${r.latest_submission_id}`)}>Review</button>
                    )}
                    {r.submission_file_name && (
                      <button className="text-xs text-slate-600 hover:underline" onClick={() => downloadSubmission(r)}>Download</button>
                    )}
                    {r.latest_submission_id && r.attempts_remaining > 0 && !r.retake_granted && r.assignment_status !== 'passed' && (
                      <button className="text-xs text-emerald-600 hover:underline" onClick={() => singleRetake(r)}>Retake</button>
                    )}
                    {r.latest_submission_id && !r.locked && (
                      <button className="text-xs text-amber-600 hover:underline" onClick={() => singleLock(r)}>Lock</button>
                    )}
                    {r.locked && (
                      <button className="text-xs text-slate-500 hover:underline" onClick={() => singleUnlock(r)}>Unlock</button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Page {page + 1} of {totalPages} · {total} total</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
          <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>Next</Button>
        </div>
      </div>
    </div>
  )
}
