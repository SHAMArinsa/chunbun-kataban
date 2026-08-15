import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Download, SlidersHorizontal, Upload } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'

const PAGE_SIZE = 10
const STEPS = ['Select Students', 'Assignment Details', 'Upload Files', 'Review & Assign']

const ENROLLMENT_STATUSES = ['pending_payment', 'active', 'completed', 'dropped', 'suspended']
const ASSESSMENT_STATUSES = ['not_assigned', 'assigned', 'in_progress', 'submitted', 'under_evaluation', 'evaluated', 'passed', 'failed', 'retake_assigned']
const STATUS_COLOR = {
  not_assigned: 'slate', assigned: 'blue', in_progress: 'blue', submitted: 'blue', under_evaluation: 'yellow',
  evaluated: 'slate', passed: 'green', failed: 'red', retake_assigned: 'yellow',
}
const attemptsColor = (remaining) => (remaining >= 3 ? 'green' : remaining === 2 ? 'blue' : remaining === 1 ? 'yellow' : 'red')

function Avatar({ name }) {
  const initials = (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
      {initials}
    </span>
  )
}

export default function AssignCodingAssessment() {
  const { codingId } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ internship_status: '', assessment_status: '' })
  const [page, setPage] = useState(0)

  const [assignmentName, setAssignmentName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [uploadFiles, setUploadFiles] = useState([])
  const [resourceFile, setResourceFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const { data: coding, isLoading: codingLoading } = useQuery({
    queryKey: ['coding-assignment', codingId],
    queryFn: () => apiClient.get(`/coding-assignments/${codingId}`).then((r) => r.data),
  })

  const rosterParams = {
    search: search || undefined,
    internship_status: filters.internship_status || undefined,
    assessment_status: filters.assessment_status || undefined,
    sort_by: 'full_name', sort_dir: 'asc',
    skip: page * PAGE_SIZE, limit: PAGE_SIZE,
  }
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['coding-roster', codingId, rosterParams],
    queryFn: () => apiClient.get(`/coding-assignments/${codingId}/roster`, { params: rosterParams }).then((r) => r.data),
    keepPreviousData: true,
    enabled: step === 1,
  })

  const isDomainCoding = !!coding?.domain_id
  const rows = roster?.items ?? []
  const total = roster?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selectableIds = rows.filter((r) => !r.locked).map((r) => r.student_id)
  const allPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))

  const toggle = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const togglePage = () => {
    if (allPageSelected) setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)))
    else setSelectedIds((prev) => [...new Set([...prev, ...selectableIds])])
  }

  const assignMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      uploadFiles.forEach((f) => formData.append('files', f))
      if (assignmentName.trim() && uploadFiles.length === 1) formData.append('title', assignmentName.trim())
      if (dueDate) formData.append('due_date', dueDate)
      if (durationMinutes) formData.append('duration_minutes', durationMinutes)

      const uploadRes = await apiClient.post(`/coding-assignments/${codingId}/problems/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      const createdSheets = uploadRes.data.sheets
      await apiClient.post(`/coding-assignments/${codingId}/assign-students`, { student_ids: selectedIds })
      for (const sheet of createdSheets) {
        await apiClient.post(`/coding-assignments/sheets/${sheet.id}/assign`, { student_ids: selectedIds })
      }
      for (const studentId of selectedIds) {
        const resourceData = new FormData()
        resourceData.append('file', resourceFile)
        await apiClient.post(`/coding-assignments/${codingId}/students/${studentId}/resource`, resourceData, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return uploadRes.data
    },
    onSuccess: () => {
      push(`Assessment assigned to ${selectedIds.length} student(s).`, 'success')
      queryClient.invalidateQueries({ queryKey: ['coding-roster', codingId] })
      queryClient.invalidateQueries({ queryKey: ['coding-sheets', codingId] })
      navigate(`/coding-assignments/${codingId}/manage`)
    },
    onError: (err) => push(err.response?.data?.detail || 'Assignment failed', 'error'),
  })

  const exportCsv = () => {
    const headers = ['Student ID', 'Name', 'Email', 'Batch', 'Assignment Status', 'Attempts Used', 'Attempts Remaining']
    const lines = rows.map((r) => [r.student_id, r.full_name, r.email, r.batch ?? '', r.assignment_status, r.attempts_used, r.attempts_remaining].join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students-page.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    setUploadFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files ?? [])])
  }

  if (codingLoading) return <Spinner />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button onClick={() => navigate(`/coding-assignments/${codingId}/manage`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to {coding?.title}
      </button>

      <h1 className="text-2xl font-semibold text-slate-900">Assign Coding Assessment</h1>

      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = step === n
          const done = step > n
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${active ? 'bg-brand-600 text-white' : done ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-slate-400'}`}>
                  {done ? <Check size={16} /> : n}
                </div>
                <span className={`whitespace-nowrap text-xs ${active ? 'font-medium text-brand-700' : 'text-slate-500'}`}>{label}</span>
              </div>
              {n < STEPS.length && <div className={`mx-2 h-0.5 flex-1 ${step > n ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Select Students</h2>
            <p className="text-xs text-slate-500">Choose one or more students to assign this coding assessment to.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <Input placeholder="Search by student name or ID…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
            </div>
            <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={15} /> Filters</Button>
            <Badge color="blue">{total} Students Found</Badge>
            <Button variant="ghost" onClick={exportCsv}><Download size={15} /> Export CSV</Button>
            <Button variant="danger" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>Clear Selection</Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
              <Select value={filters.internship_status} onChange={(e) => { setFilters((f) => ({ ...f, internship_status: e.target.value })); setPage(0) }}>
                <option value="">Internship Status: All</option>
                {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </Select>
              <Select value={filters.assessment_status} onChange={(e) => { setFilters((f) => ({ ...f, assessment_status: e.target.value })); setPage(0) }}>
                <option value="">Assessment Status: All</option>
                {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </Select>
            </div>
          )}

          {rosterLoading ? <Spinner /> : (
            <Table
              keyField="student_id"
              rowClassName={(r) => (r.locked ? 'opacity-60' : '')}
              emptyMessage="No students found."
              rows={rows}
              columns={[
                {
                  key: 'select',
                  header: <input type="checkbox" checked={allPageSelected} disabled={!selectableIds.length} onChange={togglePage} />,
                  render: (r) => <input type="checkbox" checked={selectedIds.includes(r.student_id)} disabled={r.locked} onChange={() => toggle(r.student_id)} />,
                },
                { key: 'name', header: 'Student Name', render: (r) => <span className="flex items-center gap-2"><Avatar name={r.full_name} />{r.full_name}</span> },
                { key: 'student_id', header: 'Student ID', render: (r) => `#${r.student_id}` },
                { key: 'plan', header: 'Internship Plan', render: (r) => <Badge color="blue">{(r.plan ?? '—').replace('_', ' ')}</Badge> },
                { key: 'batch', header: 'Batch', render: (r) => r.batch ?? '—' },
                { key: 'assignment_status', header: 'Assignment Status', render: (r) => <Badge color={STATUS_COLOR[r.assignment_status] ?? 'slate'}>{r.assignment_status.replace('_', ' ')}</Badge> },
                { key: 'attempts_used', header: 'Attempts Used', render: (r) => `${r.attempts_used} / ${r.max_attempts}` },
                { key: 'attempts_remaining', header: 'Attempts Remaining', render: (r) => <Badge color={attemptsColor(r.attempts_remaining)}>{r.attempts_remaining} Remaining</Badge> },
              ]}
            />
          )}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Showing {Math.min(page * PAGE_SIZE + 1, total)} to {Math.min((page + 1) * PAGE_SIZE, total)} of {total} students</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</Button>
              {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`h-8 w-8 rounded-lg text-sm ${page === i ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{i + 1}</button>
              ))}
              {totalPages > 5 && <span className="px-1">…</span>}
              <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages}>›</Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Assignment Details</h2>
          <Input label="Assignment Name" value={assignmentName} onChange={(e) => setAssignmentName(e.target.value)} placeholder="Enter assignment name" />
          <p className="text-xs text-slate-500">
            Renaming here only applies if you upload a single question document in the next step — a name you give a .zip's multiple sheets
            is derived from each file inside it instead.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Maximum Attempts</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{coding?.max_attempts} Attempts (set when this assignment was created)</div>
            </label>
            <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Input label="Reference Duration (Minutes, optional)" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="e.g. 60" />
          <p className="text-xs text-slate-500">Informational only — students are not timed and can submit whenever they're ready.</p>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Upload Question &amp; Supporting File</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300'}`}
          >
            <Upload size={28} className="text-slate-400" />
            <p className="text-sm text-slate-600">Drag and drop files here, or</p>
            <label className="cursor-pointer text-sm font-medium text-brand-600 hover:underline">
              Choose Files
              <input
                type="file"
                multiple
                accept={isDomainCoding ? '.docx,.pdf,.txt,.zip' : '.docx,.pdf,.txt'}
                className="hidden"
                onChange={(e) => setUploadFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
            </label>
            <p className="text-xs text-slate-400">Supported formats: DOCX, PDF, TXT{isDomainCoding ? ', or ZIP (containing several DOCX/PDF/TXT)' : ''}</p>
          </div>
          {uploadFiles.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-700">
              {uploadFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5">
                  {f.name}
                  <button className="text-xs text-red-600 hover:underline" onClick={() => setUploadFiles((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-200 pt-4">
            <label className="mb-1 block text-sm font-medium text-slate-900">Supporting File</label>
            <p className="mb-2 text-xs text-slate-500">This same starter/resource file will be delivered to every selected student.</p>
            <input type="file" accept=".zip,.rar,.pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png" onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)} />
            {resourceFile && <p className="mt-2 text-sm text-slate-700">Selected: {resourceFile.name}</p>}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Review &amp; Assign</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Assignment</dt><dd className="font-medium text-slate-900">{coding?.title}</dd></div>
            <div><dt className="text-slate-500">Students Selected</dt><dd className="font-medium text-slate-900">{selectedIds.length}</dd></div>
            <div><dt className="text-slate-500">Assignment Name (if renaming)</dt><dd className="font-medium text-slate-900">{assignmentName || '—'}</dd></div>
            <div><dt className="text-slate-500">Maximum Attempts</dt><dd className="font-medium text-slate-900">{coding?.max_attempts}</dd></div>
            <div><dt className="text-slate-500">Due Date</dt><dd className="font-medium text-slate-900">{dueDate || '—'}</dd></div>
            <div><dt className="text-slate-500">Duration</dt><dd className="font-medium text-slate-900">{durationMinutes ? `${durationMinutes} minutes` : '—'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">Question File(s)</dt><dd className="font-medium text-slate-900">{uploadFiles.map((f) => f.name).join(', ') || 'None selected'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">Supporting File</dt><dd className="font-medium text-slate-900">{resourceFile?.name || 'None selected'}</dd></div>
          </dl>
          {!selectedIds.length && <p className="text-xs text-red-600">Go back and select at least one student.</p>}
          {!uploadFiles.length && <p className="text-xs text-red-600">Go back and upload at least one question document.</p>}
          {!resourceFile && <p className="text-xs text-red-600">Go back and upload the supporting file.</p>}
          <p className="text-xs text-slate-500">
            Once assigned, this question is locked automatically and delivered straight to the selected student(s)' portal — you won't be
            able to change it for a student again until you grant them a retake from Evaluations.
          </p>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>Back</Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !selectedIds.length}>
            Next: {STEPS[step]} →
          </Button>
        ) : (
          <Button onClick={() => assignMutation.mutate()} disabled={!selectedIds.length || !uploadFiles.length || !resourceFile || assignMutation.isPending}>
            Assign to {selectedIds.length} Student(s)
          </Button>
        )}
      </div>
    </div>
  )
}
