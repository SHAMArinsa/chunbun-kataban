import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Download, FileText, FolderInput, SlidersHorizontal, Upload } from 'lucide-react'
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
const STEPS = ['Select Students', 'Project Details', 'Upload Problem & Resource', 'Review & Assign']

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

export default function AssignProject() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ internship_status: '', assessment_status: '' })
  const [page, setPage] = useState(0)
  const [resourceFile, setResourceFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [problemFile, setProblemFile] = useState(null)
  const [problemDragOver, setProblemDragOver] = useState(false)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}`).then((r) => r.data),
  })

  const rosterParams = {
    search: search || undefined,
    internship_status: filters.internship_status || undefined,
    assessment_status: filters.assessment_status || undefined,
    sort_by: 'full_name', sort_dir: 'asc',
    skip: page * PAGE_SIZE, limit: PAGE_SIZE,
  }
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['project-roster', projectId, rosterParams],
    queryFn: () => apiClient.get(`/projects/${projectId}/roster`, { params: rosterParams }).then((r) => r.data),
    keepPreviousData: true,
    enabled: step === 1,
  })

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
      await apiClient.post(`/projects/${projectId}/assign-students`, { student_ids: selectedIds })
      if (problemFile) {
        const formData = new FormData()
        formData.append('file', problemFile)
        await apiClient.post(`/projects/${projectId}/instructions`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      if (resourceFile) {
        for (const studentId of selectedIds) {
          const formData = new FormData()
          formData.append('file', resourceFile)
          await apiClient.post(`/projects/${projectId}/students/${studentId}/resource`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        }
      }
    },
    onSuccess: () => {
      push(`Project assigned to ${selectedIds.length} student(s).`, 'success')
      queryClient.invalidateQueries({ queryKey: ['project-roster', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      navigate(`/projects/${projectId}/manage`)
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
    const file = e.dataTransfer.files?.[0]
    if (file) setResourceFile(file)
  }

  const handleProblemDrop = (e) => {
    e.preventDefault()
    setProblemDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setProblemFile(file)
  }

  if (projectLoading) return <Spinner />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button onClick={() => navigate(`/projects/${projectId}/manage`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to {project?.title}
      </button>

      <h1 className="text-2xl font-semibold text-slate-900">Assign Project</h1>

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
            <p className="text-xs text-slate-500">Choose one or more students to assign this project to.</p>
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
          <h2 className="text-sm font-semibold text-slate-900">Project Details</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Title</dt><dd className="font-medium text-slate-900">{project?.title}</dd></div>
            <div><dt className="text-slate-500">Type</dt><dd className="font-medium text-slate-900">{project?.project_type?.replace('_', ' ')}</dd></div>
            <div><dt className="text-slate-500">Maximum Attempts</dt><dd className="font-medium text-slate-900">5 (fixed for all projects)</dd></div>
            <div><dt className="text-slate-500">Week</dt><dd className="font-medium text-slate-900">{project?.week_number ?? '—'}</dd></div>
          </dl>
          {project?.description && <p className="text-xs text-slate-500">{project.description}</p>}
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Upload Problem</h2>
            </div>
            <p className="text-xs text-slate-500">
              The question document every assigned student will see when they click "View Problem" — one shared file for
              the whole project, not per-student. Replaces the existing problem document if one is already uploaded.
              {project?.instructions_file_name && (
                <span className="mt-1 block font-medium text-slate-700">Currently uploaded: {project.instructions_file_name}</span>
              )}
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setProblemDragOver(true) }}
              onDragLeave={() => setProblemDragOver(false)}
              onDrop={handleProblemDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center ${problemDragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300'}`}
            >
              <Upload size={28} className="text-slate-400" />
              <p className="text-sm text-slate-600">Drag and drop the problem document here, or</p>
              <label className="cursor-pointer text-sm font-medium text-brand-600 hover:underline">
                Choose File
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.zip,.rar,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setProblemFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-xs text-slate-400">Supported formats: PDF, DOCX, XLSX, ZIP, RAR, JPG, PNG</p>
            </div>
            {problemFile && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                {problemFile.name}
                <button className="text-xs text-red-600 hover:underline" onClick={() => setProblemFile(null)}>Remove</button>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <FolderInput size={16} className="text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Upload Resource (Optional)</h2>
            </div>
            <p className="text-xs text-slate-500">
              Starter files or reference material handed out to the selected student(s) alongside this project — separate from the problem
              document and from the deliverable they'll submit back. Skip this if there's nothing to hand out.
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300'}`}
            >
              <Upload size={28} className="text-slate-400" />
              <p className="text-sm text-slate-600">Drag and drop a zip file here, or</p>
              <label className="cursor-pointer text-sm font-medium text-brand-600 hover:underline">
                Choose File
                <input type="file" accept=".zip" className="hidden" onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)} />
              </label>
              <p className="text-xs text-slate-400">Supported format: ZIP</p>
            </div>
            {resourceFile && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                {resourceFile.name}
                <button className="text-xs text-red-600 hover:underline" onClick={() => setResourceFile(null)}>Remove</button>
              </div>
            )}
          </Card>
        </div>
      )}

      {step === 4 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Review &amp; Assign</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Project</dt><dd className="font-medium text-slate-900">{project?.title}</dd></div>
            <div><dt className="text-slate-500">Students Selected</dt><dd className="font-medium text-slate-900">{selectedIds.length}</dd></div>
            <div><dt className="text-slate-500">Problem Document</dt><dd className="font-medium text-slate-900">{problemFile?.name || project?.instructions_file_name || 'None'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">Resource File</dt><dd className="font-medium text-slate-900">{resourceFile?.name || 'None'}</dd></div>
          </dl>
          {!selectedIds.length && <p className="text-xs text-red-600">Go back and select at least one student.</p>}
          <p className="text-xs text-slate-500">
            The selected student(s) will immediately see this project in their portal. If they've already attempted it, they stay locked out
            of resubmitting until you grant them a retake from Evaluations.
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
          <Button onClick={() => assignMutation.mutate()} disabled={!selectedIds.length || assignMutation.isPending}>
            Assign to {selectedIds.length} Student(s)
          </Button>
        )}
      </div>
    </div>
  )
}
