import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Download, ExternalLink, SlidersHorizontal, ArrowUp, ArrowDown } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
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

const SORT_OPTIONS = [
  { value: 'full_name', label: 'Student Name' },
  { value: 'email', label: 'Email' },
  { value: 'highest_score', label: 'Highest Score' },
  { value: 'current_score', label: 'Current Score' },
  { value: 'submitted_at', label: 'Submission Date' },
  { value: 'assigned_at', label: 'Assigned Date' },
  { value: 'attempts_remaining', label: 'Attempts Remaining' },
  { value: 'status', label: 'Status' },
  { value: 'evaluator', label: 'Evaluator' },
]

function toCsvValue(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function CodingAssignmentManage() {
  const { codingId } = useParams()
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
  const [assigningSheet, setAssigningSheet] = useState(null)
  const [sheetSelectedIds, setSheetSelectedIds] = useState([])

  const { data: coding, isLoading: codingLoading } = useQuery({
    queryKey: ['coding-assignment', codingId],
    queryFn: () => apiClient.get(`/coding-assignments/${codingId}`).then((r) => r.data),
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
    queryKey: ['coding-roster', codingId, rosterParams],
    queryFn: () => apiClient.get(`/coding-assignments/${codingId}/roster`, { params: rosterParams }).then((r) => r.data),
    keepPreviousData: true,
  })

  const { data: sheets } = useQuery({
    queryKey: ['coding-sheets', codingId],
    queryFn: () => apiClient.get(`/coding-assignments/${codingId}/sheets`).then((r) => r.data),
  })
  const { data: sheetAssignments } = useQuery({
    queryKey: ['coding-sheet-assignments', assigningSheet?.id],
    queryFn: () => apiClient.get(`/coding-assignments/sheets/${assigningSheet.id}/assignments`).then((r) => r.data),
    enabled: !!assigningSheet,
  })

  const rows = roster?.items ?? []
  const total = roster?.total ?? 0

  const invalidateRoster = () => {
    queryClient.invalidateQueries({ queryKey: ['coding-roster', codingId] })
    queryClient.invalidateQueries({ queryKey: ['coding-sheets', codingId] })
  }

  const assignSheetMutation = useMutation({
    mutationFn: () => apiClient.post(`/coding-assignments/sheets/${assigningSheet.id}/assign`, { student_ids: sheetSelectedIds }),
    onSuccess: (res) => {
      push(`Assigned to ${res.data.newly_assigned} student(s).`, 'success')
      invalidateRoster()
      queryClient.invalidateQueries({ queryKey: ['coding-sheet-assignments', assigningSheet.id] })
      setSheetSelectedIds([])
    },
    onError: (err) => push(err.response?.data?.detail || 'Assignment failed', 'error'),
  })

  const openSheetFile = async (sheetId, fileName) => {
    const previewWindow = window.open('', '_blank')
    if (previewWindow) previewWindow.opener = null
    try {
      const res = await apiClient.get(`/coding-assignments/sheets/${sheetId}/download`, { responseType: 'blob' })
      const contentType = res.headers['content-type'] || res.data.type || 'application/octet-stream'
      const file = new Blob([res.data], { type: contentType })
      const url = window.URL.createObjectURL(file)

      if (previewWindow) {
        previewWindow.location.href = url
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
        return
      }

      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'question'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      previewWindow?.close()
      push('Download failed', 'error')
    }
  }

  const deleteSheetMutation = useMutation({
    mutationFn: (sheetId) => apiClient.delete(`/coding-assignments/sheets/${sheetId}`),
    onSuccess: () => {
      push('Sheet deleted.', 'success')
      invalidateRoster()
    },
    onError: (err) => push(err.response?.data?.detail || 'Delete failed', 'error'),
  })

  const bulkGradeMutation = useMutation({
    mutationFn: ({ submissionIds, payload }) => Promise.all(submissionIds.map((id) => apiClient.put(`/coding-assignments/submissions/${id}/grade`, payload))),
    onSuccess: (_res, { label, count }) => {
      push(`${label} applied to ${count} student(s).`, 'success')
      invalidateRoster()
      setSelectedIds([])
    },
    onError: (err) => push(err.response?.data?.detail || 'Bulk action failed', 'error'),
  })

  if (codingLoading) return <Spinner />

  const selectedRows = rows.filter((r) => selectedIds.includes(r.student_id))
  const selectableIds = rows.filter((r) => !r.locked).map((r) => r.student_id)
  const allPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))
  const toggle = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const togglePage = () => {
    if (allPageSelected) setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)))
    else setSelectedIds((prev) => [...new Set([...prev, ...selectableIds])])
  }
  const anySelectedLocked = selectedRows.some((r) => r.locked)

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }
  const sortHeader = (label, col) => (
    <button className="flex items-center gap-1 hover:text-slate-900" onClick={() => toggleSort(col)}>
      {label} {sortBy === col && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  )

  const runBulkAction = async () => {
    if (!bulkAction) return
    const withSubmission = selectedRows.filter((r) => r.latest_submission_id)
    const withoutSubmission = selectedRows.length - withSubmission.length

    if (bulkAction === 'assign') {
      navigate(`/coding-assignments/${codingId}/assign`)
      setBulkAction('')
      return
    }
    if (bulkAction === 'export_csv') {
      exportCsv(selectedRows.length ? selectedRows : rows)
      setBulkAction('')
      return
    }
    if (bulkAction === 'export_csv_all') {
      const res = await apiClient.get(`/coding-assignments/${codingId}/roster`, { params: { ...rosterParams, skip: 0, limit: Math.max(total, 1) } })
      exportCsv(res.data.items)
      setBulkAction('')
      return
    }
    if (bulkAction === 'download_submission') {
      push('Coding assignment answers are text-only — open Review to view/copy the submitted code.', 'error')
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
      mark_evaluated: { payload: {}, label: 'Marked evaluation complete' },
    }
    const action = actionMap[bulkAction]
    if (action) bulkGradeMutation.mutate({ submissionIds, payload: action.payload, label: action.label, count: submissionIds.length })
    setBulkAction('')
  }

  const exportCsv = (list) => {
    const headers = ['Student ID', 'Name', 'Email', 'Batch', 'Enrollment Status', 'Assignment Status', 'Attempts Used', 'Max Attempts', 'Attempts Remaining', 'Highest Score %', 'Current Score %', 'Evaluation Status', 'Assigned Date', 'Submission Date', 'Evaluator', 'Last Updated']
    const lines = list.map((r) => [
      r.student_id, r.full_name, r.email, r.batch ?? '', r.enrollment_status, r.assignment_status,
      r.attempts_used, r.max_attempts, r.attempts_remaining, r.highest_score_pct ?? '', r.current_score_pct ?? '',
      r.evaluation_status, r.assigned_at ?? '', r.submitted_at ?? '', r.evaluator ?? '', r.last_updated ?? '',
    ].map(toCsvValue).join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${coding?.title || 'coding-assignment'}-roster.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const singleRetake = (r) => bulkGradeMutation.mutate({ submissionIds: [r.latest_submission_id], payload: { admin_marked_status: 'retake' }, label: 'Retake assigned', count: 1 })
  const singleLock = (r) => bulkGradeMutation.mutate({ submissionIds: [r.latest_submission_id], payload: { admin_marked_status: 'closed' }, label: 'Locked', count: 1 })
  const singleUnlock = (r) => bulkGradeMutation.mutate({ submissionIds: [r.latest_submission_id], payload: { admin_marked_status: null }, label: 'Unlocked', count: 1 })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to Coding Assignments
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{coding?.title}</h1>
        <p className="text-sm text-slate-500">{coding?.num_problems} problems · {coding?.required_correct} correct required · max {coding?.max_attempts} attempts · {total} student(s) in program</p>
      </div>

      {/* Sticky toolbar */}
      <Card className="sticky top-0 z-10 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <Input placeholder="Search by name, email, or student ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
          </div>
          <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={15} /> Filters</Button>
          <Button variant="ghost" onClick={() => refetch()}><RefreshCw size={15} /> Refresh</Button>
          <Button variant="ghost" onClick={() => exportCsv(rows)}><Download size={15} /> Export CSV (page)</Button>
          <Button onClick={() => navigate(`/coding-assignments/${codingId}/assign`)}>Assign Coding Assessment</Button>
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
            <Input type="number" placeholder="Min Score %" value={filters.score_min} onChange={(e) => { setFilters((f) => ({ ...f, score_min: e.target.value })); setPage(0) }} />
            <Input type="number" placeholder="Max Score %" value={filters.score_max} onChange={(e) => { setFilters((f) => ({ ...f, score_max: e.target.value })); setPage(0) }} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
          <span className="text-sm text-slate-600">{selectedIds.length} selected</span>
          <div className="w-64">
            <Select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option value="">Bulk action…</option>
              <option value="assign">Assign Coding Assessment</option>
              <option value="retake">Assign Retake</option>
              <option value="lock">Lock Assessment</option>
              <option value="unlock">Unlock Assessment</option>
              <option value="mark_evaluated">Mark Evaluation Complete</option>
              <option value="download_submission">Download Submission</option>
              <option value="export_csv">Export Selected (CSV)</option>
              <option value="export_csv_all">Export Entire Filtered Result (CSV)</option>
            </Select>
          </div>
          <Button variant="secondary" onClick={runBulkAction} disabled={!bulkAction || bulkGradeMutation.isPending}>Apply</Button>
          {anySelectedLocked && bulkAction === 'assign' && <span className="text-xs text-amber-600">Locked students in your selection will be skipped for new questions.</span>}
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
              { key: 'highest_score', header: sortHeader('Highest', 'highest_score'), render: (r) => (r.highest_score_pct != null ? `${Math.round(r.highest_score_pct)}%` : '—') },
              { key: 'current_score', header: sortHeader('Current', 'current_score'), render: (r) => (r.current_score_pct != null ? `${Math.round(r.current_score_pct)}%` : '—') },
              { key: 'evaluation_status', header: 'Evaluation', render: (r) => r.evaluation_status.replace('_', ' ') },
              { key: 'submitted_at', header: sortHeader('Submitted', 'submitted_at'), render: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—') },
              { key: 'evaluator', header: sortHeader('Evaluator', 'evaluator'), render: (r) => r.evaluator ?? '—' },
              {
                key: 'actions',
                header: 'Actions',
                render: (r) => (
                  <div className="flex flex-wrap gap-1.5">
                    {r.latest_submission_id && (
                      <button className="text-xs text-brand-600 hover:underline" onClick={() => navigate(`/evaluations/review/coding_assignment/${r.latest_submission_id}`)}>Review</button>
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

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Uploaded Question Sheets</h2>
        {sheets?.length ? (
          <div className="space-y-2">
            {sheets.map((sheet) => (
              <div key={sheet.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    {sheet.source_file_name ? (
                      <button
                        type="button"
                        onClick={() => openSheetFile(sheet.id, sheet.source_file_name)}
                        className="flex items-center gap-1 text-left text-sm font-medium text-brand-600 hover:underline"
                        title={`Open ${sheet.source_file_name}`}
                      >
                        {sheet.source_file_name} <ExternalLink size={14} />
                      </button>
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{sheet.title}</p>
                    )}
                    <p className="text-xs text-slate-500">{sheet.problem_count} problems · assigned to {sheet.assigned_student_count} student(s)</p>
                    {!sheet.source_file_name && <p className="text-xs text-amber-600">No original file on record for this sheet — uploaded before file storage was added.</p>}
                  </div>
                  <div className="flex gap-2">
                    {sheet.source_file_name ? (
                      <Button variant="secondary" onClick={() => openSheetFile(sheet.id, sheet.source_file_name)}>
                        <ExternalLink size={15} /> Open file
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => setAssigningSheet(sheet)}>Assign / Change Students</Button>
                    <Button variant="danger" onClick={() => deleteSheetMutation.mutate(sheet.id)} disabled={deleteSheetMutation.isPending}>Delete</Button>
                  </div>
                </div>
                {sheet.assigned_students?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {sheet.assigned_students.map((s) => {
                      const roster = rows.find((r) => r.student_id === s.student_id)
                      const retakeGranted = roster?.retake_granted
                      return (
                        <span
                          key={s.student_id}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${retakeGranted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                          title={s.email}
                        >
                          {s.full_name}
                          {retakeGranted && ' (retake enabled)'}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No question sheets uploaded yet.</p>
        )}
      </Card>

      <Modal
        open={!!assigningSheet}
        onClose={() => { setAssigningSheet(null); setSheetSelectedIds([]) }}
        title={`Assign Sheet: ${assigningSheet?.title ?? ''}`}
        footer={<Button onClick={() => assignSheetMutation.mutate()} disabled={!sheetSelectedIds.length || assignSheetMutation.isPending}>Assign to {sheetSelectedIds.length} Selected</Button>}
      >
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {rows?.map((s) => {
            const alreadyAssigned = sheetAssignments?.some((a) => a.student_id === s.student_id)
            return (
              <label key={s.student_id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${s.locked ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                <input
                  type="checkbox"
                  checked={sheetSelectedIds.includes(s.student_id) || alreadyAssigned}
                  disabled={alreadyAssigned || s.locked}
                  onChange={() => setSheetSelectedIds((prev) => (prev.includes(s.student_id) ? prev.filter((x) => x !== s.student_id) : [...prev, s.student_id]))}
                />
                <span>
                  {s.full_name}
                  <span className="ml-1 text-xs text-slate-400">{s.email}</span>
                  {alreadyAssigned && <span className="ml-1 text-xs text-emerald-600">(already assigned)</span>}
                  {s.locked && !alreadyAssigned && <span className="ml-1 text-xs text-amber-600">(locked — attempted)</span>}
                </span>
              </label>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
