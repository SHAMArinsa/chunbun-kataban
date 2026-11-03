import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Download, FileText, Lock, Pencil, Plus, Search, Upload, X } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import Table from '../../components/ui/Table'
import { CurriculumSection, MaterialsSection, QuestionsSection, SectionTitle } from './TierContent'
import FeedbackChat from '../../components/v2/FeedbackChat'
import { KeyValues, PageHeader, Progress, Status, Tabs, TextArea } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { downloadFile, errorText, fmtDate, fmtDateTime, humanize, tierLabel } from '../../lib/v2'

// Each tier only gets the tabs that apply to it.
const TABS_BY_TIER = {
  basic: ['questions', 'materials', 'project_questions'],
  professional: ['questions', 'materials', 'project_questions'],
  advanced: ['materials', 'assign'],
  career: ['materials', 'assign'],
  accelerator: ['videos', 'assign', 'projects', 'internship'],
}
const TAB_LABELS = { questions: 'Questions', materials: 'Study Materials', videos: 'Videos', assign: 'Assign Work', projects: 'Assign Project Work', project_questions: 'Project Questions', internship: 'Assign Internship Task' }
// Old links (?tab=forms etc.) still land on the right tab.
const OLD_TAB = { options: 'project_questions', forms: 'assign', assignments: 'assign', mcq: 'questions' }

function useSave(keys, okMessage = 'Saved') {
  const qc = useQueryClient()
  const { push } = useToast()
  return useMutation({
    mutationFn: ({ method = 'post', url, body, config }) => apiClient[method](url, body, config),
    onSuccess: () => {
      push(okMessage, 'success')
      keys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
    onError: (e) => push(errorText(e), 'error'),
  })
}

export default function WorkManagement() {
  const { tier } = useParams()
  const [params] = useSearchParams()
  const initial = params.get('tab')
  const reviewTabs = ['review', 'submissions', 'evaluation', 'eligibility', 'mocks', 'selections']
  const [tab, setTab] = useState(OLD_TAB[initial] || initial || null)
  if (reviewTabs.includes(initial)) return <Navigate to={initial === 'mocks' ? `/mock-interviews/${tier}` : initial === 'selections' ? `/selections/${tier}` : `/evaluate/${tier}`} replace />
  const TABS = TABS_BY_TIER[tier] || ['materials']
  const current = TABS.includes(tab) ? tab : TABS[0]
  return (
    <div>
      <PageHeader title={`${tierLabel(tier)} · Work Management`} subtitle="Everything on this page is for this program only." />
      <Tabs tabs={TABS.map((k) => ({ key: k, label: TAB_LABELS[k] }))} value={current} onChange={setTab} />
      {current === 'questions' && (
        <>
          <SectionTitle title="MCQ Questions" text="The question bank students of this program answer." />
          <QuestionsSection tier={tier} />
          <p className="mt-4 text-sm text-slate-500">Student scores: <Link className="font-medium text-brand-700 hover:underline" to={`/mcq-results/${tier}`}>MCQ Results → {tierLabel(tier)}</Link> in the sidebar.</p>
        </>
      )}
      {current === 'materials' && <MaterialsSection key={`m-${tier}`} tier={tier} />}
      {current === 'videos' && <CurriculumSection key={`v-${tier}`} tier={tier} />}
      {current === 'project_questions' && (
        <>
          <SectionTitle title="Project Questions" text={`The projects ${tierLabel(tier)} students choose from on their Project Selection page — each student picks ${tier === 'basic' ? '1' : '2'}. Only published projects are shown to students.`} />
          <OptionsTab tier={tier} />
          <p className="mt-4 text-sm text-slate-500">To see which project each student picked, open <Link className="font-medium text-brand-700 hover:underline" to={`/selections/${tier}`}>Student Selections → {tierLabel(tier)}</Link> in the sidebar.</p>
        </>
      )}
      {current === 'assign' && tier !== 'accelerator' && (
        <>
          <SectionTitle title="Assign Work — 1 per student" text={`Each ${tierLabel(tier)} student gets their own single task or project, based on their internship form and resume.`} />
          <SingleAssignTab tier={tier} />
        </>
      )}
      {current === 'assign' && tier === 'accelerator' && (
        <>
          <SectionTitle title="Assign Work — 22 Assignments" text="Build several sets of the 22 technical assignments. Every student automatically gets one set, so classmates don't share the same questions." />
          <AccelAssignmentsTab />
        </>
      )}
      {current === 'internship' && (
        <>
          <SectionTitle title="Assign Internship Task — 3 per student" text="After a Career Accelerator student submits their Internship Form & Resume, give them their own 3 internship tasks (task, live project or office work)." />
          <InternshipTasksTab />
        </>
      )}
      {current === 'projects' && (
        <>
          <SectionTitle title="Assign Project Work — 3 Real-World Projects" text="Give every Career Accelerator student their own 3 projects. Students see only the projects assigned to them." />
          <AccelProjectsTab />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ project options */
function DefinitionModal({ open, onClose, initial, onSave, accelerator }) {
  const [f, setF] = useState(initial || {})
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const submit = () => {
    const body = { ...f, sequence_number: f.sequence_number ? Number(f.sequence_number) : null, is_active: f.is_active ?? true }
    if (accelerator) {
      body.available_after_days = f.available_after_days === '' || f.available_after_days == null ? null : Number(f.available_after_days)
      body.due_after_days = f.due_after_days === '' || f.due_after_days == null ? null : Number(f.due_after_days)
    }
    onSave(body)
  }
  return (
    <Modal open={open} onClose={onClose} wide title={initial?.id ? 'Edit' : 'Create'} footer={<Button onClick={submit}>Save</Button>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Title" value={f.title || ''} onChange={set('title')} /></div>
        <Input label={accelerator ? 'Assignment number (1–22)' : 'Display number'} type="number" value={f.sequence_number ?? ''} onChange={set('sequence_number')} />
        <Input label="Technology" value={f.technology || ''} onChange={set('technology')} placeholder="e.g. FastAPI + React + PostgreSQL" />
        {accelerator && <Input label="Available after (days from start)" type="number" value={f.available_after_days ?? ''} onChange={set('available_after_days')} />}
        {accelerator && <Input label="Deadline (days from start)" type="number" value={f.due_after_days ?? ''} onChange={set('due_after_days')} />}
        <div className="sm:col-span-2"><TextArea label={accelerator ? 'Question / problem statement' : 'Project details & requirements'} value={f.description || ''} onChange={set('description')} /></div>
        <div className="sm:col-span-2"><TextArea label="Instructions" value={f.instructions || ''} onChange={set('instructions')} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active ?? true} onChange={set('is_active')} /> Published (visible to students)</label>
      </div>
    </Modal>
  )
}

function ResourceUpload({ projectId, onDone }) {
  const save = useSave([['v2']], 'Resource uploaded')
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-brand-700 hover:underline">
      <Upload size={13} /> Upload file
      <input type="file" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const body = new FormData()
        body.append('file', file)
        save.mutate({ url: `/v2/staff/projects/${projectId}/resource`, body }, { onSuccess: onDone })
      }} />
    </label>
  )
}

function OptionsTab({ tier }) {
  const [edit, setEdit] = useState(null)
  const key = ['v2', 'options', tier]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get(`/v2/staff/work/${tier}/options`).then((r) => r.data) })
  const save = useSave([key])
  const required = tier === 'basic' ? 1 : 2
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <p className="text-sm text-slate-500">
          Students read all published options and select <b>exactly {required}</b>. Selections lock on confirmation. Recommended: 9–10 {tier === 'basic' ? 'small' : 'large'} projects.
        </p>
        <Button onClick={() => setEdit({})}><Plus size={16} /> Add project</Button>
      </div>
      {isLoading ? <Spinner /> : (
        <Table
          rows={data}
          emptyMessage="No project options yet."
          columns={[
            { key: 'number', header: '#' },
            { key: 'title', header: 'Title' },
            { key: 'technology', header: 'Technology' },
            { key: 'selected_by', header: 'Selected by' },
            { key: 'is_active', header: 'Status', render: (r) => <Status value={r.is_active ? 'active' : 'draft'} label={r.is_active ? 'Published' : 'Hidden'} /> },
            { key: 'resource', header: 'Details PDF', render: (r) => (r.resource_file_name
              ? <button className="max-w-[180px] truncate text-left text-xs text-brand-700 hover:underline" title={r.resource_file_name} onClick={() => downloadFile(`/v2/staff/projects/${r.id}/resource`, r.resource_file_name)}>📄 {r.resource_file_name}</button>
              : <span className="text-xs text-amber-600">Missing — click edit</span>) },
            { key: 'guide', header: 'Instructions PDF', render: (r) => (r.instructions_file_name
              ? <button className="max-w-[180px] truncate text-left text-xs text-brand-700 hover:underline" title={r.instructions_file_name} onClick={() => downloadFile(`/v2/staff/projects/${r.id}/resource?kind=instructions`, r.instructions_file_name)}>📄 {r.instructions_file_name}</button>
              : <span className="text-xs text-slate-400">—</span>) },
            { key: 'edit', header: '', render: (r) => <button onClick={() => setEdit(r)} className="text-slate-500 hover:text-brand-700"><Pencil size={15} /></button> },
          ]}
        />
      )}
      {edit && <ProjectOptionModal tier={tier} initial={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function PdfDrop({ label, hint, required, current, file, onFile, push }) {
  const [drag, setDrag] = useState(false)
  const pick = (x) => {
    if (!x) return
    if (!x.name.toLowerCase().endsWith('.pdf')) { push('Please choose a PDF file', 'error'); return }
    onFile(x)
  }
  const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-800">{label}{required && <span className="text-red-500">*</span>}{!required && <span className="ml-1 font-normal text-slate-400">optional</span>}</span>
      {current && !file && <p className="mb-2 text-xs text-slate-600">Current: <span className="font-medium">📄 {current}</span> — upload a new PDF to replace it.</p>}
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm">
          <span className="truncate font-medium text-slate-800">📄 {file.name} <span className="font-normal text-slate-500">· {size(file.size)}</span></span>
          <button type="button" className="shrink-0 text-xs font-medium text-red-600 hover:underline" onClick={() => onFile(null)}>Remove</button>
        </div>
      ) : (
        <label onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${drag ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}>
          <Upload size={20} className="text-slate-400" />
          <span className="text-sm text-slate-600"><span className="font-semibold text-brand-700">Click to upload</span> or drag and drop</span>
          <span className="text-xs text-slate-400">{hint} · PDF · up to 25 MB</span>
          <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}
    </div>
  )
}

function ProjectOptionModal({ tier, initial, onClose }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const [f, setF] = useState({ title: initial.title || '', sequence_number: initial.number ?? '', technology: initial.technology || '', is_active: initial.is_active ?? true })
  const [details, setDetails] = useState(null)
  const [instructions, setInstructions] = useState(null)
  const [busy, setBusy] = useState(false)
  const editing = !!initial.id
  const needsDetails = !editing || !initial.resource_file_name
  const upload = (id, file, kind) => { const fd = new FormData(); fd.append('file', file); return apiClient.post(`/v2/staff/projects/${id}/resource`, fd, { params: { kind } }) }
  const save = async () => {
    setBusy(true)
    try {
      // Details and instructions now live in the PDFs; keep any older text as-is.
      const body = { title: f.title.trim(), technology: f.technology || null, sequence_number: f.sequence_number === '' ? null : Number(f.sequence_number),
        is_active: f.is_active, description: initial.description ?? null, instructions: initial.instructions ?? null }
      const id = editing ? (await apiClient.put(`/v2/staff/projects/${initial.id}`, body), initial.id)
        : (await apiClient.post(`/v2/staff/work/${tier}/options`, body)).data.id
      if (details) await upload(id, details, 'details')
      if (instructions) await upload(id, instructions, 'instructions')
      push(editing ? 'Project updated' : 'Project added', 'success')
      qc.invalidateQueries({ queryKey: ['v2'] })
      onClose()
    } catch (e) {
      push(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  const cls = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  return (
    <Modal open wide onClose={() => !busy && onClose()} title={editing ? 'Edit project' : 'Add project'}
      footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || f.title.trim().length < 3 || (needsDetails && !details)} onClick={save}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add project'}</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-800">Project title<span className="text-red-500">*</span></span>
          <input autoFocus className={cls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Banking Loan Risk Assessment System" /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-800">Number</span>
          <input type="number" min="1" className={cls} value={f.sequence_number} onChange={(e) => setF({ ...f, sequence_number: e.target.value })} placeholder="auto" /></label>
        <label className="block text-sm sm:col-span-2"><span className="mb-1 block font-medium text-slate-800">Technology <span className="font-normal text-slate-400">optional</span></span>
          <input className={cls} value={f.technology} onChange={(e) => setF({ ...f, technology: e.target.value })} placeholder="e.g. Python, Flask, HTML" /></label>
        <div className="grid grid-cols-1 gap-4 sm:col-span-2 md:grid-cols-2">
          <PdfDrop label="1. Project details & requirements" hint="What to build" required={needsDetails} current={initial.resource_file_name} file={details} onFile={setDetails} push={push} />
          <PdfDrop label="2. Instructions" hint="How to work & submit" current={initial.instructions_file_name} file={instructions} onFile={setInstructions} push={push} />
        </div>
        <p className="-mt-1 text-xs text-slate-500 sm:col-span-2">Students see the title with <b>View Project →</b>, which opens both PDFs inside the portal (as two tabs).</p>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Published (visible to students)</label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ selections */
export function SelectionsTab({ tier }) {
  const [reset, setReset] = useState(null)
  const [f, setF] = useState({})
  const key = ['v2', 'selections', tier]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get(`/v2/staff/work/${tier}/selections`).then((r) => r.data) })
  const { data: options } = useQuery({ queryKey: ['v2', 'options', tier], queryFn: () => apiClient.get(`/v2/staff/work/${tier}/options`).then((r) => r.data) })
  const save = useSave([key, ['v2', 'options', tier]], 'Selection updated')
  const required = tier === 'basic' ? 1 : 2
  const submit = () => {
    const ids = [f.p1, f.p2].filter(Boolean).map(Number)
    save.mutate({ url: `/v2/staff/enrollments/${reset.enrollment_id}/selections/reset`, body: { reason: f.reason, new_project_ids: ids.length ? ids : null } },
      { onSuccess: () => { setReset(null); setF({}) } })
  }
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const all = data || []
  const done = (r) => (r.selections || []).length >= required
  const counts = { all: all.length, selected: all.filter(done).length }
  counts.pending = all.length - counts.selected
  const term = q.trim().toLowerCase()
  const rows = all.filter((r) => (!term || [r.student_number, r.name, r.email, ...(r.selections || []).map((x) => x.project_title)].join(' ').toLowerCase().includes(term))
    && (st === 'all' || (st === 'selected' ? done(r) : !done(r))))
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student ID, name or project…" aria-label="Search selections"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X size={14} /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'All'], ['selected', 'Selected'], ['pending', 'Not selected']].map(([k, l]) => (
            <button key={k} onClick={() => setSt(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${st === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:border-brand-400'}`}>
              {l} <span className="opacity-70">({counts[k]})</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{rows.length} of {all.length} students</span>
      </div>
      {isLoading ? <Spinner /> : (
        <Table
          keyField="enrollment_id"
          rows={rows}
          emptyMessage={all.length ? 'No students match your search.' : 'No students yet.'}
          columns={[
            { key: 'student_number', header: 'Student ID' },
            { key: 'name', header: 'Student', render: (r) => <Link className="text-brand-700 hover:underline" to={`/enrollments/${r.enrollment_id}`}>{r.name}</Link> },
            ...Array.from({ length: required }, (_, i) => ({
              key: `p${i}`, header: required === 1 ? 'Selected project' : `Project ${i + 1}`,
              render: (r) => r.selections.find((s) => s.slot === i + 1)?.project_title || <span className="text-slate-400">Not selected</span>,
            })),
            { key: 'at', header: 'Confirmed', render: (r) => fmtDateTime(r.selections[0]?.selected_at) },
            { key: 'reset', header: '', render: (r) => <Button variant="ghost" onClick={() => setReset(r)}>Reset / change</Button> },
          ]}
        />
      )}
      <Modal open={!!reset} onClose={() => setReset(null)} title={`Reset selection – ${reset?.name}`} footer={<Button variant="danger" disabled={!f.reason} onClick={submit}>Apply</Button>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Leave the projects empty to let the student choose again, or pick the new project(s) directly. The previous selection stays in history.</p>
          {Array.from({ length: required }, (_, i) => (
            <Select key={i} label={`New project ${required > 1 ? i + 1 : ''}`} value={f[`p${i + 1}`] || ''} onChange={(e) => setF({ ...f, [`p${i + 1}`]: e.target.value })}>
              <option value="">— Student chooses again —</option>
              {options?.filter((o) => o.is_active).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          ))}
          <TextArea label="Reason (required)" value={f.reason || ''} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </div>
      </Modal>
    </Card>
  )
}

/* ------------------------------------------------------------------ submissions */
function ReviewModal({ submissionId, onClose }) {
  const [grade, setGrade] = useState('')
  const { data } = useQuery({ queryKey: ['v2', 'submission', submissionId], queryFn: () => apiClient.get(`/v2/staff/submissions/${submissionId}`).then((r) => r.data) })
  const save = useSave([['v2']], 'Review saved')
  if (!data) return <Modal open onClose={onClose} title="Loading…"><Spinner /></Modal>
  const latest = data.versions[0]
  const review = (action) => save.mutate({ url: `/v2/staff/submissions/${latest.id}/review`, body: { action, feedback: null, grade: grade !== '' ? Number(grade) : null } }, { onSuccess: onClose })
  return (
    <Modal open xl onClose={onClose} title={`${data.student.name} – ${data.project.title}`}
      footer={latest.status !== 'graded' ? (
        <div className="flex w-full flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">Grade
            <input type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="0–100"
              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <span className="hidden text-xs text-slate-500 md:inline">Send your feedback in the chat, then choose a decision.</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => review('under_review')}>Mark under review</Button>
            <Button variant="danger" onClick={() => review('revision_required')}>Request revision</Button>
            <Button onClick={() => review('completed')}>Mark completed</Button>
          </div>
        </div>
      ) : <span className="text-sm text-slate-500">This submission is completed{latest.grade != null ? ` · Grade ${latest.grade}` : ''}.</span>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted work</p>
          {data.versions.map((v, i) => (
            <div key={v.id} className={`rounded-xl border p-3 ${i === 0 ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Version {v.version}{i === 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">(latest)</span>}</p>
                <Status value={v.status} label={v.status_label} />
              </div>
              <p className="mb-2 text-xs text-slate-500">{fmtDateTime(v.submitted_at)}</p>
              <div className="space-y-1.5 text-sm">
                {v.repo_link && <p className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">GitHub</span><a href={v.repo_link} target="_blank" rel="noreferrer" className="min-w-0 break-all text-brand-700 hover:underline">{v.repo_link}</a></p>}
                {v.demo_url && <p className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Demo</span><a href={v.demo_url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-brand-700 hover:underline">{v.demo_url}</a></p>}
                {v.has_file && <p className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">File</span><button className="inline-flex items-center gap-1 text-brand-700 hover:underline" onClick={() => downloadFile(`/v2/staff/submissions/${v.id}/download`)}><Download size={13} /> Download</button></p>}
                {v.notes && <p className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Notes</span><span className="min-w-0 whitespace-pre-wrap">{v.notes}</span></p>}
                {v.grade != null && <p className="flex gap-2"><span className="w-16 shrink-0 text-slate-500">Grade</span><b>{v.grade}</b></p>}
              </div>
            </div>
          ))}
          {data.history.length > 0 && (
            <details className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold uppercase text-slate-500">Review history ({data.history.length})</summary>
              <ul className="mt-2 space-y-1">
                {data.history.map((h, i) => <li key={i}>{fmtDateTime(h.at)} · {h.reviewer} · {humanize(h.previous_status)} → <b>{humanize(h.status)}</b>{h.feedback ? ` · “${h.feedback}”` : ''}</li>)}
              </ul>
            </details>
          )}
        </div>
        <div className="lg:col-span-3">
          <FeedbackChat me="staff" queryKey={['v2', 'feedback', latest.id]} height="h-[46vh]"
            listUrl={`/v2/staff/submissions/${latest.id}/messages`} postUrl={`/v2/staff/submissions/${latest.id}/messages`}
            title={`Chat with ${data.student.name}`}
            emptyText="No messages yet. Explain what to fix — you can attach or paste screenshots." />
        </div>
      </div>
    </Modal>
  )
}

export function SubmissionsTab({ tier }) {
  const [status, setStatus] = useState('submitted')
  const [kind, setKind] = useState('')
  const [open, setOpen] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'submissions', tier, status, kind],
    queryFn: () => apiClient.get(`/v2/staff/work/${tier}/submissions`, { params: { status: status || undefined, kind: kind || undefined } }).then((r) => r.data),
  })
  return (
    <Card>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="submitted">Submitted (to review)</option>
          <option value="under_review">Under review</option>
          <option value="revision_requested">Revision required</option>
          <option value="graded">Completed</option>
        </select>
        {tier === 'accelerator' && (
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All work</option>
            <option value="accelerator_assignment">Assignments</option>
            <option value="real_world_project">Real-world projects</option>
            <option value="internship_task">Internship tasks</option>
          </select>
        )}
      </div>
      {isLoading ? <Spinner /> : (
        <Table
          rows={data}
          emptyMessage="Nothing here."
          columns={[
            { key: 'student', header: 'Student' },
            { key: 'work', header: 'Work' },
            { key: 'version', header: 'Version' },
            { key: 'submitted_at', header: 'Submitted', render: (r) => fmtDateTime(r.submitted_at) },
            { key: 'status', header: 'Status', render: (r) => <Status value={r.status} label={r.status_label} /> },
            { key: 'open', header: '', render: (r) => <Button variant="secondary" onClick={() => setOpen(r.id)}>Open</Button> },
          ]}
        />
      )}
      {open && <ReviewModal submissionId={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}

/* ------------------------------------------------------------------ MCQ */
export function McqTab({ tier }) {
  const { data, isLoading } = useQuery({ queryKey: ['v2', 'mcq', tier], queryFn: () => apiClient.get(`/v2/staff/reports/mcq`, { params: { tier } }).then((r) => r.data.rows) })
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const all = data || []
  const counts = { all: all.length, Passed: all.filter((r) => r.mcq_status === 'Passed').length, 'Not passed': all.filter((r) => r.mcq_status === 'Not passed').length }
  counts.other = all.length - counts.Passed - counts['Not passed']
  const term = q.trim().toLowerCase()
  const rows = all.filter((r) => (!term || `${r.student_number ?? ''} ${r.name ?? ''} ${r.email ?? ''}`.toLowerCase().includes(term))
    && (st === 'all' || (st === 'other' ? !['Passed', 'Not passed'].includes(r.mcq_status) : r.mcq_status === st)))
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student ID or name…" aria-label="Search students"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X size={14} /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'All'], ['Passed', 'Passed'], ['Not passed', 'Not passed'], ['other', 'Not attempted']].map(([k, l]) => (
            <button key={k} onClick={() => setSt(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${st === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:border-brand-400'}`}>
              {l} <span className="opacity-70">({counts[k]})</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">Best score per student · {rows.length} of {all.length}</span>
      </div>
      {isLoading ? <Spinner /> : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">{all.length ? 'No students match your search.' : 'No MCQ attempts yet.'}</p>
      ) : (
        <Table
          keyField="enrollment_id"
          rows={rows}
          columns={[
            { key: 'student_number', header: 'Student ID' }, { key: 'name', header: 'Student' },
            { key: 'score', header: 'Score', render: (r) => (r.total ? `${r.correct} / ${r.total}` : '—') },
            { key: 'percentage', header: '%', render: (r) => (r.percentage != null ? `${r.percentage}%` : '—') },
            { key: 'attempts', header: 'Attempts', render: (r) => <span>{r.attempts ?? 0}{r.terminated ? <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700" title="Ended by a proctoring violation or abandoned — counted with 0 marks">{r.terminated} terminated</span> : null}</span> },
            { key: 'mcq_status', header: 'Status', render: (r) => <Status value={r.mcq_status === 'Passed' ? 'passed' : r.mcq_status === 'Not passed' ? 'failed' : 'not_started'} label={r.mcq_status} /> },
          ]}
        />
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ forms + assigned work */
function DetailedFormView({ data }) {
  const d = data.details || {}
  const show = (f) => !f.show_if || Object.entries(f.show_if).every(([k, a]) => a.includes(d[k]))
  const fmt = (f, v) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return <span className="text-slate-400">—</span>
    if (f.type === 'tags') return <span className="flex flex-wrap gap-1">{v.map((x) => <span key={x} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{x}</span>)}</span>
    if (f.type === 'leveled') return <span className="flex flex-wrap gap-1">{v.map((x) => <span key={x.name} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{x.name} · <b>{x.level}</b></span>)}</span>
    return <span className="whitespace-pre-wrap">{String(v)}</span>
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
        {[['Student ID', data.student.student_number], ['Email', data.student.email], ['Status', humanize(data.status)], ['Review', humanize(data.review_status)]].map(([k, v]) => (
          <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="truncate font-medium">{v}</p></div>
        ))}
      </div>
      {data.schema.map((sec) => (
        <section key={sec.key} className="rounded-lg border border-slate-200">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{sec.title}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 p-3 text-sm sm:grid-cols-2">
            {sec.fields.filter(show).map((f) => (
              <div key={f.key} className={['textarea', 'tags', 'leveled'].includes(f.type) ? 'sm:col-span-2' : ''}>
                <dt className="text-xs text-slate-500">{f.label}</dt><dd className="text-slate-900">{fmt(f, d[f.key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function FormModal({ formId, onClose }) {
  const [feedback, setFeedback] = useState('')
  const { data } = useQuery({ queryKey: ['v2', 'form', formId], queryFn: () => apiClient.get(`/v2/staff/forms/${formId}`).then((r) => r.data) })
  const save = useSave([['v2']], 'Form review saved')
  if (!data) return <Modal open onClose={onClose} title="Loading…"><Spinner /></Modal>
  const review = (review_status) => save.mutate({ url: `/v2/staff/forms/${formId}/review`, body: { review_status, feedback: feedback || null } }, { onSuccess: onClose })
  return (
    <Modal open wide xl={!!data.schema} onClose={onClose} title={`Internship form – ${data.student.name}`}
      footer={data.review_status === 'accepted'
        ? <><span className="mr-auto inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><Lock size={15} /> Accepted — this form is locked and can no longer be changed by the student or admins.</span><Button variant="secondary" onClick={onClose}>Close</Button></>
        : <><Button variant="ghost" onClick={() => review('under_review')}>Under review</Button><Button variant="danger" onClick={() => review('revision_required')}>Ask for changes</Button><Button onClick={() => window.confirm('Accept this form? Once accepted it is locked — neither the student nor any admin can change it.') && review('accepted')}>Accept</Button></>}>
      {data.schema ? <DetailedFormView data={data} /> : null}
      <div className={data.schema ? 'hidden' : 'space-y-4'}>
        <KeyValues items={[
          ['Student ID', data.student.student_number], ['Email', data.student.email], ['Phone', data.student.phone],
          ['Education', data.education], ['College / University', data.institution], ['Area of interest', data.area_of_interest],
          ['Preferred role / internship area', data.preferred_role], ['Status', humanize(data.status)], ['Review', humanize(data.review_status)],
        ]} />
        {[['Skills / technologies', data.skills], ['Previous experience', data.experience], ['Additional information', data.comments]].map(([k, v]) => v && (
          <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="whitespace-pre-wrap text-sm">{v}</p></div>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1 text-xs text-slate-500">Resume versions</p>
          {data.resumes.map((r) => (
            <button key={r.id} onClick={() => downloadFile(`/v2/staff/resumes/${r.id}/download`, r.file_name)} className="mr-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
              <Download size={13} /> v{r.version} · {r.file_name}
            </button>
          ))}
        </div>
        {data.review_status !== 'accepted' && <TextArea label="Feedback (shown to the student if you ask for changes)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />}
      </div>
    </Modal>
  )
}

function AssignModal({ row, tier, onClose }) {
  const [f, setF] = useState({ work_type: 'task' })
  const [file, setFile] = useState(null)
  const save = useSave([['v2']], 'Work assigned & student notified')
  const types = tier === 'accelerator'
    ? [['task', 'Internship task'], ['live_project', 'Live project'], ['office_work', 'Office work']]
    : [['task', 'Task'], ['project', 'Project']]
  const submit = () => {
    const body = new FormData()
    Object.entries(f).forEach(([k, v]) => v && body.append(k, v))
    if (file) body.append('file', file)
    save.mutate({ url: `/v2/staff/enrollments/${row.enrollment_id}/assignments`, body }, { onSuccess: onClose })
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal open wide onClose={onClose} title={`Assign work – ${row.name}`} footer={<Button disabled={!f.title} onClick={submit}>Assign</Button>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Title" value={f.title || ''} onChange={set('title')} /></div>
        <Select label="Type" value={f.work_type} onChange={set('work_type')}>{types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Input label="Deadline" type="date" value={f.deadline || ''} onChange={set('deadline')} />
        <Input label="Technology" value={f.technology || ''} onChange={set('technology')} />
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Resource file (optional)</span><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        <div className="sm:col-span-2"><TextArea label="Description" value={f.description || ''} onChange={set('description')} /></div>
        <div className="sm:col-span-2"><TextArea label="Instructions" value={f.instructions || ''} onChange={set('instructions')} /></div>
      </div>
    </Modal>
  )
}

function FormsTab({ tier }) {
  const [form, setForm] = useState(null)
  const [assign, setAssign] = useState(null)
  const { data, isLoading } = useQuery({ queryKey: ['v2', 'forms', tier], queryFn: () => apiClient.get(`/v2/staff/work/${tier}/forms`).then((r) => r.data) })
  return (
    <Card>
      <p className="border-b border-slate-100 p-4 text-sm text-slate-500">
        Students do not choose their work here. Review each student’s form, resume and area of interest, then assign tasks/projects.
        {tier === 'accelerator' && ' The Internship Form unlocks 5 months + 20 days after enrollment.'}
      </p>
      {isLoading ? <Spinner /> : (
        <Table
          keyField="enrollment_id"
          rows={data}
          columns={[
            { key: 'student_number', header: 'Student ID' },
            { key: 'name', header: 'Student', render: (r) => <Link className="text-brand-700 hover:underline" to={`/enrollments/${r.enrollment_id}`}>{r.name}</Link> },
            tier === 'accelerator' && { key: 'available_on', header: 'Form available', render: (r) => fmtDate(r.available_on) },
            { key: 'form_status', header: 'Form', render: (r) => <Status value={r.form_status} /> },
            { key: 'review_status', header: 'Review', render: (r) => <Status value={r.review_status} /> },
            { key: 'area_of_interest', header: 'Area of interest' },
            { key: 'assigned_work', header: 'Assigned' },
            {
              key: 'actions', header: '', render: (r) => (
                <div className="flex gap-2">
                  {r.form_id && r.form_status !== 'draft' && <Button variant="secondary" onClick={() => setForm(r.form_id)}>View form</Button>}
                  {tier !== 'accelerator' && r.assigned_work > 0
                    ? <span className="self-center text-xs font-medium text-emerald-700">1 / 1 assigned</span>
                    : <Button disabled={!r.form_id || r.form_status === 'draft'} onClick={() => setAssign(r)}>Assign work</Button>}
                </div>
              ),
            },
          ].filter(Boolean)}
        />
      )}
      {form && <FormModal formId={form} onClose={() => setForm(null)} />}
      {assign && <AssignModal row={assign} tier={tier} onClose={() => setAssign(null)} />}
    </Card>
  )
}

/* ------------------------------------------------------------------ mock interviews */
const toLocalInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

function MockFiles({ mockId, initial }) {
  const { push } = useToast()
  const qc = useQueryClient()
  const [files, setFiles] = useState(initial || [])
  const [busy, setBusy] = useState(false)
  const upload = async (list) => {
    if (!list?.length) return
    setBusy(true)
    try {
      const fd = new FormData()
      Array.from(list).forEach((f) => fd.append('files', f))
      const { data } = await apiClient.post(`/v2/staff/mock-interviews/${mockId}/files`, fd)
      setFiles(data); push(`${list.length} file${list.length > 1 ? 's' : ''} uploaded`, 'success'); qc.invalidateQueries({ queryKey: ['v2', 'mocks'] })
    } catch (e) { push(errorText(e), 'error') } finally { setBusy(false) }
  }
  const remove = async (id) => {
    try { const { data } = await apiClient.delete(`/v2/staff/mock-interview-files/${id}`); setFiles(data); qc.invalidateQueries({ queryKey: ['v2', 'mocks'] }) } catch (e) { push(errorText(e), 'error') }
  }
  return (
    <div className="sm:col-span-2">
      <p className="mb-1 text-sm font-medium text-slate-700">Feedback files <span className="font-normal text-slate-400">(optional · the student can download them)</span></p>
      {files.length > 0 && (
        <ul className="mb-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <button type="button" onClick={() => downloadFile(`/v2/staff/mock-interview-files/${f.id}/download`, f.name)} className="min-w-0 flex-1 truncate text-left text-brand-700 hover:underline">{f.name}</button>
              {f.size ? <span className="text-xs text-slate-400">{f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}</span> : null}
              <button type="button" onClick={() => window.confirm(`Remove ${f.name}?`) && remove(f.id)} aria-label={`Remove ${f.name}`} className="rounded p-1 text-slate-400 hover:text-red-600"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {mockId ? (
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 text-sm ${busy ? 'border-slate-200 text-slate-400' : 'border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700'}`}>
          <Upload size={16} /> {busy ? 'Uploading…' : 'Upload one or more files (PDF, DOCX, images, ZIP…)'}
          <input type="file" multiple className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        </label>
      ) : <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Save the interview first, then you can attach feedback files.</p>}
    </div>
  )
}

function MockModal({ row, slot, onClose }) {
  const init = slot.id ? { ...slot, scheduled_at: slot.scheduled_at ? toLocalInput(new Date(slot.scheduled_at)) : '' } : { status: 'scheduled', overall_result: 'pending' }
  const [f, setF] = useState(init)
  const save = useSave([['v2']], 'Mock interview saved & student notified')
  const req = row.requests?.[slot.number]
  const locked = !!slot.id && ((slot.status === 'completed' && slot.attendance_status === 'present') || ['pass', 'fail'].includes(slot.overall_result))
  const willLock = !locked && ((f.status === 'completed' && f.attendance_status === 'present') || ['pass', 'fail'].includes(f.overall_result))
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    const body = { ...f, interview_number: slot.number, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null }
    for (const k of ['attendance_status']) if (!body[k]) body[k] = null
    delete body.id; delete body.number; delete body.files
    save.mutate({ method: 'put', url: `/v2/staff/enrollments/${row.enrollment_id}/mock-interviews`, body }, { onSuccess: onClose })
  }
  if (locked) {
    return (
      <Modal open wide onClose={onClose} title={`Mock interview ${slot.number} – ${row.name}`} footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <Lock size={16} className="mt-0.5 shrink-0" /> This interview is done{['pass', 'fail'].includes(slot.overall_result) ? ` (result: ${slot.overall_result === 'pass' ? 'Pass' : 'Fail'})` : ''}, so it is locked and can't be edited or scheduled again.
          </div>
          <KeyValues items={[
            ['Date & time', fmtDateTime(slot.scheduled_at)], ['Interviewer', slot.interviewer_name], ['Meeting link', slot.meeting_link],
            ['Status', humanize(slot.status)], ['Attendance', humanize(slot.attendance_status)], ['Result', humanize(slot.overall_result)],
          ]} />
          {[['Technical feedback', slot.technical_feedback], ['Communication feedback', slot.communication_feedback], ['Overall feedback', slot.feedback]].map(([k, v]) => v && (
            <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="whitespace-pre-wrap text-sm">{v}</p></div>
          ))}
          {slot.files?.length > 0 && (
            <div><p className="mb-1 text-xs text-slate-500">Feedback files</p>
              {slot.files.map((x) => <button key={x.id} type="button" onClick={() => downloadFile(`/v2/staff/mock-interview-files/${x.id}/download`, x.name)} className="mr-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><Download size={13} /> {x.name}</button>)}
            </div>
          )}
        </div>
      </Modal>
    )
  }
  return (
    <Modal open wide onClose={onClose} title={`Mock interview ${slot.number} – ${row.name}`}
      footer={<>{willLock && <span className="mr-auto text-xs text-amber-700">Saving with a Pass/Fail result (or Completed + Present) locks this interview permanently — add feedback files before saving.</span>}<Button disabled={!f.scheduled_at || save.isPending} onClick={() => (!willLock || window.confirm('Save and lock this interview? It cannot be edited afterwards.')) && submit()}>Save</Button></>}>
      {req && (
        <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-800">Student's preferred timings {req.status === 'scheduled' && <span className="ml-1 text-xs font-normal text-emerald-700">(scheduled)</span>}</p>
          <div className="flex flex-wrap gap-2">
            {req.preferred_times.map((t) => {
              const local = toLocalInput(new Date(t))
              const tooSoon = new Date(t) - Date.now() < 3 * 86400000
              return (
                <button key={t} type="button" disabled={tooSoon} onClick={() => setF({ ...f, scheduled_at: local, status: f.status === 'cancelled' ? 'scheduled' : f.status })}
                  title={tooSoon ? 'Less than 3 days away — can no longer be scheduled' : 'Use this timing'}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${f.scheduled_at === local ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-brand-400'} disabled:cursor-not-allowed disabled:opacity-40`}>
                  {fmtDateTime(t)}
                </button>
              )
            })}
          </div>
          {req.note && <p className="mt-2 text-xs text-slate-600">Note: {req.note}</p>}
        </div>
      )}
      <p className="mb-3 text-xs text-slate-500">Rules: schedule at least 3 days ahead{row.window?.latest ? `, and on or before ${fmtDate(row.window.latest)} (14 days before the internship ends)` : ''}. An interview less than 3 days away can't be cancelled or moved.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Date & time" type="datetime-local" value={f.scheduled_at || ''} onChange={set('scheduled_at')} min={toLocalInput(new Date(Date.now() + 3 * 86400000))} max={row.window?.latest ? `${row.window.latest}T23:59` : undefined} />
        <Input label="Interviewer" value={f.interviewer_name || ''} onChange={set('interviewer_name')} />
        <div className="sm:col-span-2"><Input label="Meeting link" value={f.meeting_link || ''} onChange={set('meeting_link')} /></div>
        <Select label="Interview status" value={f.status} onChange={set('status')}>{['scheduled', 'rescheduled', 'completed', 'cancelled', 'no_show'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
        <Select label="Attendance" value={f.attendance_status || ''} onChange={set('attendance_status')}><option value="">—</option>{['present', 'absent', 'excused'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
        <TextArea label="Technical feedback" value={f.technical_feedback || ''} onChange={set('technical_feedback')} rows={3} />
        <TextArea label="Communication feedback" value={f.communication_feedback || ''} onChange={set('communication_feedback')} rows={3} />
        <TextArea label="Overall feedback" value={f.feedback || ''} onChange={set('feedback')} rows={3} />
        <Select label="Result" value={f.overall_result} onChange={(e) => setF({ ...f, overall_result: e.target.value, status: ['pass', 'fail'].includes(e.target.value) && ['scheduled', 'rescheduled'].includes(f.status) ? 'completed' : f.status })}>{['pending', 'pass', 'fail'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
        <MockFiles mockId={slot.id} initial={slot.files} />
      </div>
    </Modal>
  )
}

export function MocksTab({ tier }) {
  const [edit, setEdit] = useState(null)
  const { data, isLoading } = useQuery({ queryKey: ['v2', 'mocks', tier], queryFn: () => apiClient.get(`/v2/staff/work/${tier}/mock-interviews`).then((r) => r.data) })
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const all = data || []
  const cat = (r) => {
    const iv = r.interviews || []
    const done = (m) => m.status === 'completed' || ['pass', 'fail'].includes(m.overall_result)
    if (iv.length && iv.every(done)) return 'completed'
    if (iv.some((m) => m.id && ['scheduled', 'rescheduled'].includes(m.status))) return 'scheduled'
    if (Object.values(r.requests || {}).some((q) => q.status === 'pending')) return 'requested'
    return 'pending'
  }
  const counts = { all: all.length, pending: 0, requested: 0, scheduled: 0, completed: 0 }
  all.forEach((r) => { counts[cat(r)] += 1 })
  const term = q.trim().toLowerCase()
  const rows = all.filter((r) => (!term || `${r.student_number ?? ''} ${r.name ?? ''} ${r.email ?? ''}`.toLowerCase().includes(term)) && (st === 'all' || cat(r) === st))
  return (
    <Card>
      <p className="border-b border-slate-100 px-4 pt-4 pb-3 text-sm text-slate-500">
        {tier === 'accelerator' ? 'Students request each slot by email at least 2 weeks ahead (planned for months 6, 9 and 12). Enter the confirmed details here.' : 'One mock interview per Career Internship student.'}
      </p>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student ID, name or email…" aria-label="Search mock interviews"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X size={14} /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'All'], ['requested', 'Timings received / resent'], ['pending', 'Not requested'], ['scheduled', 'Scheduled'], ['completed', 'Completed']].map(([k, l]) => (
            <button key={k} onClick={() => setSt(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${st === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:border-brand-400'}`}>
              {l} <span className="opacity-70">({counts[k]})</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{rows.length} of {all.length} students</span>
      </div>
      {isLoading ? <Spinner /> : (
        <Table
          keyField="enrollment_id"
          rows={rows}
          emptyMessage={all.length ? 'No students match your search.' : 'No students yet.'}
          columns={[
            { key: 'student_number', header: 'Student ID' },
            { key: 'name', header: 'Student' },
            ...(all[0]?.interviews || [{ number: 1 }]).map((_, i) => ({
              key: `m${i}`, header: `Interview ${i + 1}`,
              render: (r) => {
                const m = r.interviews[i]
                const req = r.requests?.[i + 1]
                if (m.id && m.status === 'cancelled' && req?.status === 'pending') {
                  return (
                    <button onClick={() => setEdit({ row: r, slot: m })} className="text-left hover:underline">
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">↻ Resent · 5 new timings · Schedule</span>
                      <span className="block text-xs text-slate-400"><span className="line-through">{fmtDateTime(m.scheduled_at)}</span> cancelled</span>
                    </button>
                  )
                }
                return (
                  <button onClick={() => setEdit({ row: r, slot: m })} className="text-left hover:underline">
                    {m.id && ['pass', 'fail'].includes(m.overall_result) ? <><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.overall_result === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>✓ Done · {m.overall_result === 'pass' ? 'Pass' : 'Fail'}</span><span className="block text-xs text-slate-500">{fmtDateTime(m.scheduled_at)}</span></> : m.id ? <><Status value={m.status} />{m.status === 'completed' && m.attendance_status === 'present' && <Lock size={12} className="ml-1 inline text-slate-400" aria-label="Locked" />} <span className="block text-xs text-slate-500">{fmtDateTime(m.scheduled_at)}{m.overall_result && m.overall_result !== 'pending' ? ` · ${humanize(m.overall_result)}` : ''}</span></> : r.requests?.[i + 1]?.status === 'pending' ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">5 timings received · Schedule</span> : <span className="text-xs text-brand-700">+ Schedule</span>}
                  </button>
                )
              },
            })),
          ]}
        />
      )}
      {edit && <MockModal row={edit.row} slot={edit.slot} onClose={() => setEdit(null)} />}
    </Card>
  )
}

/* ------------------------------------------------------------------ accelerator assignments */
function AccelAssignmentsTab() {
  const [edit, setEdit] = useState(null)
  const [setNo, setSetNo] = useState(1)
  const [extra, setExtra] = useState(0)
  const key = ['v2', 'accel-assignments', setNo]
  const setsKey = ['v2', 'accel-sets']
  const { data: sets } = useQuery({ queryKey: setsKey, queryFn: () => apiClient.get('/v2/staff/work/accelerator/assignment-sets').then((r) => r.data) })
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get('/v2/staff/work/accelerator/assignments', { params: { set_number: setNo } }).then((r) => r.data) })
  const save = useSave([['v2', 'accel-assignments'], setsKey])
  const list = [...(sets?.sets || [])]
  for (let i = 0; i < extra; i += 1) list.push({ number: list.length + 1, count: 0, ready: false, students: 0 })
  const readyCount = list.filter((x) => x.ready).length
  const used = new Set((data || []).map((r) => r.number))
  const nextFree = Array.from({ length: 22 }, (_, i) => i + 1).find((n) => !used.has(n))
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">Question sets</p>
            <p className="text-sm text-slate-500">Each new student is automatically given <b>one complete set</b> (all 22 filled) — picked at random from the least-used sets — and keeps it for the whole program. Different sets make leaked answers useless.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readyCount >= (sets?.min_sets || 10) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {readyCount} of {sets?.min_sets || 10} recommended sets ready
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((x) => (
            <button key={x.number} onClick={() => setSetNo(x.number)}
              className={`min-w-[92px] rounded-xl border px-3 py-2 text-left transition ${setNo === x.number ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">Set {x.number}
                {x.ready ? <CheckCircle2 size={14} className="text-emerald-600" /> : <span className="h-2 w-2 rounded-full bg-amber-400" />}</span>
              <span className="block text-[11px] text-slate-500">{x.count}/22 · {x.students} student{x.students === 1 ? '' : 's'}</span>
            </button>
          ))}
          <button onClick={() => { setExtra(extra + 1); setSetNo(list.length + 1) }} className="rounded-xl border-2 border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700"><Plus size={14} className="inline" /> New set</button>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <p className="font-semibold text-slate-900">Set {setNo}</p>
            <p className="text-sm text-slate-500"><b>{data?.length ?? 0} / 22</b> assignments {(data?.length ?? 0) >= 22 ? <span className="font-medium text-emerald-700">— complete, students can receive this set</span> : <span className="text-amber-700">— add all 22 before students can receive this set</span>}. Dates are relative to each student's start date.</p>
          </div>
          <Button disabled={(data?.length ?? 0) >= 22} onClick={() => setEdit({ number: nextFree })}><Plus size={16} /> Add assignment</Button>
        </div>
        {isLoading ? <Spinner /> : (
          <Table
            rows={data}
            emptyMessage={`Set ${setNo} is empty. Add its 22 assignments.`}
            columns={[
              { key: 'number', header: '#' }, { key: 'title', header: 'Title' }, { key: 'technology', header: 'Technology' },
              { key: 'available_after_days', header: 'Opens (day)' }, { key: 'due_after_days', header: 'Due (day)' },
              { key: 'is_active', header: 'Status', render: (r) => <Status value={r.is_active ? 'active' : 'draft'} label={r.is_active ? 'Published' : 'Hidden'} /> },
              { key: 'res', header: 'Resource', render: (r) => <div className="flex gap-2">{r.resource_file_name && <span className="text-xs text-slate-500">{r.resource_file_name}</span>}<ResourceUpload projectId={r.id} /></div> },
              { key: 'edit', header: '', render: (r) => <button onClick={() => setEdit(r)} className="text-slate-500 hover:text-brand-700"><Pencil size={15} /></button> },
            ]}
          />
        )}
      </Card>
      {edit && (
        <DefinitionModal
          open accelerator
          initial={{ ...edit, sequence_number: edit.number }}
          onClose={() => setEdit(null)}
          onSave={(body) => save.mutate(
            edit.id ? { method: 'put', url: `/v2/staff/work/accelerator/assignments/${edit.id}`, body: { ...body, set_number: setNo } } : { url: '/v2/staff/work/accelerator/assignments', body: { ...body, set_number: setNo } },
            { onSuccess: () => setEdit(null) },
          )}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ accelerator: 3 real-world projects, per student */
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const fileSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function FieldLabel({ children, hint, required, count, max }) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <span className="text-sm font-medium text-slate-800">{children}{required && <span className="ml-0.5 text-red-500">*</span>}{hint && <span className="ml-2 font-normal text-slate-400">{hint}</span>}</span>
      {max && <span className={`text-xs ${count > max ? 'text-red-600' : 'text-slate-400'}`}>{count}/{max}</span>}
    </div>
  )
}

function RwpModal({ student, slot, onClose, mode = 'rwp', tier }) {
  const single = mode === 'single'
  const editing = !!slot.assignment_id
  const qc = useQueryClient()
  const { push } = useToast()
  const [f, setF] = useState({ title: slot.title || '', description: slot.description || '', instructions: slot.instructions || '', technology: slot.technology || '', deadline: slot.deadline || '', ...(single ? { work_type: slot.work_type || 'task' } : {}) })
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.title.trim().length >= 3 && f.title.length <= 200
  const pastDue = f.deadline && f.deadline < new Date().toISOString().slice(0, 10)
  const cls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  const submit = async () => {
    setBusy(true)
    try {
      if (single && editing) {
        await apiClient.put(`/v2/staff/assigned-work/${slot.assignment_id}`, { ...f, title: f.title.trim(), deadline: f.deadline || null, technology: f.technology || null })
        if (file) { const fd = new FormData(); fd.append('file', file); await apiClient.post(`/v2/staff/projects/${slot.project_id}/resource`, fd) }
      } else if (single) {
        const body = new FormData()
        Object.entries({ ...f, title: f.title.trim() }).forEach(([k, v]) => v && body.append(k, v))
        if (file) body.append('file', file)
        await apiClient.post(`/v2/staff/enrollments/${student.enrollment_id}/assignments`, body)
      } else if (editing) {
        await apiClient.put(`/v2/staff/real-world-projects/${slot.assignment_id}`, { ...f, title: f.title.trim(), deadline: f.deadline || null, technology: f.technology || null })
        if (file) { const fd = new FormData(); fd.append('file', file); await apiClient.post(`/v2/staff/projects/${slot.project_id}/resource`, fd) }
      } else {
        const body = new FormData()
        body.append('number', slot.number)
        Object.entries({ ...f, title: f.title.trim() }).forEach(([k, v]) => v && body.append(k, v))
        if (file) body.append('file', file)
        await apiClient.post(`/v2/staff/enrollments/${student.enrollment_id}/real-world-projects`, body)
      }
      push(single ? (editing ? 'Assigned work updated' : `Work assigned to ${student.name}`) : editing ? `Project ${slot.number} updated` : `Project ${slot.number} assigned to ${student.name}`, 'success')
      qc.invalidateQueries({ queryKey: ['v2'] })
      onClose()
    } catch (e) {
      push(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="rwp-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-white px-6 py-5">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white shadow-sm">{single ? '1' : slot.number}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{single ? `${tierLabel(tier)} · ${editing ? 'Edit assigned work' : 'Assign work'}` : editing ? 'Edit real-world project' : 'Assign real-world project'}</p>
              <h2 id="rwp-title" className="text-lg font-semibold text-slate-900">{single ? 'Task or project (1 of 1)' : `Project ${slot.number} of 3`}</h2>
              <p className="text-sm text-slate-500">for <span className="font-medium text-slate-700">{student.name}</span> · ID {student.student_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!single && <div className="hidden items-center gap-1.5 sm:flex" aria-label="Project slots">
              {student.projects.map((p) => (
                <span key={p.number} title={`Project ${p.number}${p.assignment_id ? ' — assigned' : ''}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${p.number === slot.number ? 'bg-violet-600 text-white ring-2 ring-violet-200' : p.assignment_id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{p.number}</span>
              ))}
            </div>}
            <button onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">1 · {single ? 'Work details' : 'Project details'}</h3>
            {single && (
              <div>
                <FieldLabel required>Type</FieldLabel>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="radiogroup">
                  {[['task', 'Task', 'A focused piece of work'], ['project', 'Project', 'A larger build with a deliverable']].map(([v, l, d]) => (
                    <button key={v} type="button" role="radio" aria-checked={f.work_type === v} onClick={() => setF({ ...f, work_type: v })}
                      className={`rounded-md px-4 py-1.5 text-left text-sm transition ${f.work_type === v ? 'bg-white font-semibold text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {l}<span className="block text-[11px] font-normal text-slate-400">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <FieldLabel required count={f.title.length} max={200}>{single ? 'Title' : 'Project title'}</FieldLabel>
              <input autoFocus className={cls} value={f.title} onChange={set('title')} placeholder={single ? (f.work_type === 'task' ? 'e.g. Write unit tests for the login API' : 'e.g. Build an inventory management REST API') : 'e.g. Customer churn prediction for a telecom company'} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel hint="optional">Technology / stack</FieldLabel>
                <input className={cls} value={f.technology} onChange={set('technology')} placeholder="Python, scikit-learn, FastAPI" />
              </div>
              <div>
                <FieldLabel hint="optional">Due date</FieldLabel>
                <input type="date" className={cls} value={f.deadline} min={editing ? undefined : new Date().toISOString().slice(0, 10)} onChange={set('deadline')} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[['2 weeks', 14], ['1 month', 30], ['2 months', 60], ['3 months', 90]].map(([label, n]) => (
                    <button key={n} type="button" onClick={() => setF({ ...f, deadline: addDays(n) })}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition ${f.deadline === addDays(n) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700'}`}>+{label}</button>
                  ))}
                  {f.deadline && <button type="button" onClick={() => setF({ ...f, deadline: '' })} className="px-1 text-xs text-slate-400 hover:text-slate-600">Clear</button>}
                </div>
                {pastDue && <p className="mt-1 text-xs text-amber-600">This date is in the past.</p>}
                {student?.end_date && (() => {
                  const end = String(student.end_date).slice(0, 10)
                  const days = Math.ceil((new Date(end) - new Date(new Date().toISOString().slice(0, 10))) / 86400000)
                  const after = f.deadline && f.deadline > end
                  return (
                    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${after ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      Programme ends <b>{fmtDate(end)}</b>{days >= 0 ? ` · ${days} day${days === 1 ? '' : 's'} left` : ' · already ended'}
                      {f.deadline !== end && <button type="button" onClick={() => setF({ ...f, deadline: end })} className="ml-2 font-medium text-violet-700 hover:underline">Use end date</button>}
                      {after && <span className="mt-1 block font-medium">The due date is after the student’s programme ends.</span>}
                    </div>
                  )
                })()}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">2 · Brief for the student</h3>
            <div>
              <FieldLabel hint="what to build, requirements, expected outcome">{single ? 'Brief' : 'Project brief'}</FieldLabel>
              <textarea rows={5} className={cls} value={f.description} onChange={set('description')}
                placeholder={'Problem statement…\n\nRequirements:\n• …\n\nExpected outcome:\n• …'} />
            </div>
            <div>
              <FieldLabel hint="optional">Submission instructions</FieldLabel>
              <textarea rows={2} className={cls} value={f.instructions} onChange={set('instructions')}
                placeholder="e.g. Submit a GitHub link with a README, plus a ZIP of the notebook and a 1-page report." />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">3 · Attachment <span className="normal-case tracking-normal text-slate-400">(optional)</span></h3>
            {editing && slot.resource_file_name && !file && <p className="text-sm text-slate-600">Current file: <span className="font-medium">📎 {slot.resource_file_name}</span> — choose a new one below to replace it.</p>}
            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm"><Upload size={16} /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{fileSize(file.size)}</p></div>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const x = e.dataTransfer.files?.[0]; if (x) setFile(x) }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${drag ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}>
                <Upload size={20} className="text-slate-400" />
                <span className="text-sm text-slate-600"><span className="font-semibold text-violet-700">Click to upload</span> or drag and drop</span>
                <span className="text-xs text-slate-400">Brief or dataset · PDF, DOCX, XLSX, ZIP, TXT · up to 25 MB</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </section>
        </div>

        {/* footer */}
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">{editing ? 'Changes are visible to the student right away.' : `${student.name} will get a notification and see this project in their portal.`}</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button disabled={busy || !valid} onClick={submit}>{busy ? 'Saving…' : editing ? 'Save changes' : single ? `Assign ${f.work_type === 'task' ? 'task' : 'project'}` : `Assign Project ${slot.number}`}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectSlot({ slot, onAssign, onEdit, onRemove }) {
  if (!slot.assignment_id) {
    return (
      <button onClick={onAssign} className="flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 p-4 text-sm text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700">
        <Plus size={20} />
        <span className="font-semibold">Assign Project {slot.number}</span>
        <span className="text-xs">Not assigned yet</span>
      </button>
    )
  }
  return (
    <div className="flex min-h-[132px] flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-violet-600">Project {slot.number}</span>
        <Status value={slot.status || 'in_progress'} label={slot.versions ? slot.status_label : 'Not submitted'} />
      </div>
      <p className="font-semibold leading-snug text-slate-900">{slot.title}</p>
      {slot.technology && <p className="text-xs text-slate-500">{slot.technology}</p>}
      <p className="mt-1 text-xs text-slate-500">{slot.deadline ? `Due ${fmtDate(slot.deadline)}` : 'No due date'}{slot.resource_file_name ? ` · 📎 ${slot.resource_file_name}` : ''}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs">
        <button className="font-medium text-brand-700 hover:underline" onClick={onEdit}>Edit</button>
        <ResourceUpload projectId={slot.project_id} />
        <button className="text-red-600 hover:underline" onClick={onRemove}>Remove</button>
      </div>
    </div>
  )
}


/* ------------------------------------------------------------------ accelerator internship tasks */
const INTERN_TYPES = [['internship_task', 'Internship task'], ['live_project', 'Live project'], ['office_work', 'Office work']]

function InternTaskModal({ student, slot, onClose }) {
  const editing = !!slot.assignment_id
  const [f, setF] = useState(editing
    ? { title: slot.title, work_type: slot.work_type, technology: slot.technology || '', deadline: slot.deadline || '', description: slot.description || '', instructions: slot.instructions || '' }
    : { work_type: 'internship_task' })
  const [file, setFile] = useState(null)
  const save = useSave([['v2']], editing ? 'Task updated' : 'Task assigned & student notified')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (editing) {
      save.mutate({ method: 'put', url: `/v2/staff/assigned-work/${slot.assignment_id}`, body: { ...f, deadline: f.deadline || null } }, { onSuccess: onClose })
      return
    }
    const body = new FormData()
    Object.entries({ ...f, work_type: f.work_type === 'internship_task' ? 'task' : f.work_type }).forEach(([k, v]) => v && body.append(k, v))
    if (file) body.append('file', file)
    save.mutate({ url: `/v2/staff/enrollments/${student.enrollment_id}/assignments`, body }, { onSuccess: onClose })
  }
  return (
    <Modal open wide onClose={onClose} title={`${editing ? 'Edit' : 'Assign'} Internship Task ${slot.number} – ${student.name}`}
      footer={<Button disabled={!f.title || f.title.length < 3 || save.isPending} onClick={submit}>{editing ? 'Save changes' : 'Assign task'}</Button>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Title" value={f.title || ''} onChange={set('title')} placeholder="e.g. Build a sales-forecast dashboard" /></div>
        <Select label="Type" value={f.work_type} onChange={set('work_type')}>{INTERN_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Input label="Deadline" type="date" value={f.deadline || ''} onChange={set('deadline')} />
        <Input label="Technology" value={f.technology || ''} onChange={set('technology')} placeholder="e.g. Python, FastAPI, React" />
        {!editing && <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Resource file (optional)</span><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" /></label>}
        <div className="sm:col-span-2"><TextArea label="Description" value={f.description || ''} onChange={set('description')} /></div>
        <div className="sm:col-span-2"><TextArea label="Instructions" value={f.instructions || ''} onChange={set('instructions')} /></div>
      </div>
    </Modal>
  )
}

function InternTaskSlot({ slot, ready, lockedText, onAssign, onEdit, onRemove }) {
  if (!slot.assignment_id) {
    if (!ready) {
      return (
        <div className="flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
          <Lock size={18} /><span className="font-semibold">Task {slot.number}</span><span className="text-xs">{lockedText}</span>
        </div>
      )
    }
    return (
      <button onClick={onAssign} className="flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 p-4 text-sm text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700">
        <Plus size={20} /><span className="font-semibold">Assign Task {slot.number}</span><span className="text-xs">Not assigned yet</span>
      </button>
    )
  }
  return (
    <div className="flex min-h-[132px] flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-violet-600">Task {slot.number} · {humanize(slot.work_type === 'internship_task' ? 'task' : slot.work_type)}</span>
        <Status value={slot.status || 'in_progress'} label={slot.versions ? slot.status_label : 'Not submitted'} />
      </div>
      <p className="font-semibold leading-snug text-slate-900">{slot.title}</p>
      {slot.technology && <p className="text-xs text-slate-500">{slot.technology}</p>}
      <p className="mt-1 text-xs text-slate-500">{slot.deadline ? `Due ${fmtDate(slot.deadline)}` : 'No due date'}{slot.resource_file_name ? ` · 📎 ${slot.resource_file_name}` : ''}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs">
        <button className="font-medium text-brand-700 hover:underline" onClick={onEdit}>Edit</button>
        <ResourceUpload projectId={slot.project_id} />
        {!slot.versions && <button className="text-red-600 hover:underline" onClick={onRemove}>Remove</button>}
      </div>
    </div>
  )
}

function InternshipTasksTab() {
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const [modal, setModal] = useState(null)
  const [formId, setFormId] = useState(null)
  const key = ['v2', 'forms', 'accelerator']
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get('/v2/staff/work/accelerator/forms').then((r) => r.data) })
  const remove = useSave([['v2']], 'Task removed')
  if (isLoading || !data) return <Spinner />
  const ready = (s) => ['submitted', 'completed'].includes(s.form_status)
  const count = (s) => (s.internship_tasks || []).filter((t) => t.assignment_id).length
  const cat = (s) => (!ready(s) ? 'waiting' : count(s) >= 3 ? 'done' : 'ready')
  const counts = { all: data.length, ready: 0, waiting: 0, done: 0 }
  data.forEach((s) => { counts[cat(s)] += 1 })
  const term = q.trim().toLowerCase()
  const rows = data.filter((s) => (!term || `${s.name} ${s.student_number} ${s.email}`.toLowerCase().includes(term)) && (st === 'all' || cat(s) === st))
  const lockedText = (s) => (s.form_status === 'locked' ? `Form opens ${fmtDate(s.available_on)}` : 'Waiting for the Internship Form')
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'All students'], ['ready', 'Ready to assign'], ['waiting', 'Waiting for form'], ['done', 'All 3 assigned']].map(([k, l]) => (
            <button key={k} onClick={() => setSt(k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${st === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:border-brand-400'}`}>{l} <span className="opacity-70">({counts[k]})</span></button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student name or ID…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
        </div>
      </Card>
      {rows.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">{data.length ? 'No student matches.' : 'No Career Accelerator students yet.'}</Card>}
      {rows.map((s) => (
        <Card key={s.enrollment_id} className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {(s.name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/enrollments/${s.enrollment_id}`} className="text-base font-semibold text-slate-900 hover:text-brand-700">{s.name}</Link>
                {ready(s)
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">✓ Form submitted</span>
                  : <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700"><Lock size={11} /> {s.form_status === 'locked' ? `Form opens ${fmtDate(s.available_on)}` : `Form ${humanize(s.form_status).toLowerCase()}`}</span>}
                {s.review_status && ready(s) && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Review: {humanize(s.review_status)}</span>}
              </div>
              <p className="mt-0.5 text-sm text-slate-600">ID {s.student_number} · {s.email}{s.area_of_interest ? <> · Area: <b className="font-medium text-slate-800">{s.area_of_interest}</b></> : ''}</p>
            </div>
            {s.form_id && (
              <Button variant="secondary" onClick={() => setFormId(s.form_id)}><FileText size={15} /> Review form & resume</Button>
            )}
            <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${count(s) === 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{count(s)} / 3 assigned</span>
          </div>
          <div className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(s.internship_tasks || [1, 2, 3].map((n) => ({ number: n }))).map((slot) => (
              <InternTaskSlot key={slot.number} slot={slot} ready={ready(s)} lockedText={lockedText(s)}
                onAssign={() => setModal({ student: s, slot })} onEdit={() => setModal({ student: s, slot })}
                onRemove={() => window.confirm(`Remove Task ${slot.number} (“${slot.title}”) from ${s.name}?`) && remove.mutate({ method: 'delete', url: `/v2/staff/assigned-work/${slot.assignment_id}` })} />
            ))}
          </div>
          </div>
        </Card>
      ))}
      {modal && <InternTaskModal student={modal.student} slot={modal.slot} onClose={() => setModal(null)} />}
      {formId && <FormModal formId={formId} onClose={() => setFormId(null)} />}
    </div>
  )
}

function AccelProjectsTab() {
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null) // { student, slot }
  const key = ['v2', 'accel-projects']
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get('/v2/staff/work/accelerator/projects').then((r) => r.data) })
  const remove = useSave([key], 'Project removed')
  if (isLoading || !data) return <Spinner />
  const term = q.trim().toLowerCase()
  const rows = data.filter((s) => !term || `${s.name} ${s.student_number} ${s.email}`.toLowerCase().includes(term))
  const assigned = data.reduce((n, s) => n + s.assigned, 0)
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-600">
          Each student gets their <b>own</b> 3 projects. <b>{assigned}</b> of <b>{data.length * 3}</b> projects assigned across <b>{data.length}</b> student{data.length === 1 ? '' : 's'}.
        </p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student name or ID…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-72" />
      </Card>
      {rows.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">{data.length ? 'No student matches your search.' : 'No Career Accelerator students yet.'}</Card>}
      {rows.map((s) => (
        <Card key={s.enrollment_id} className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link to={`/enrollments/${s.enrollment_id}`} className="font-semibold text-slate-900 hover:text-brand-700">{s.name}</Link>
              <span className="ml-2 text-sm text-slate-500">ID {s.student_number} · {s.email}</span>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.assigned === 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{s.assigned} / 3 assigned</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {s.projects.map((slot) => (
              <ProjectSlot key={slot.number} slot={slot}
                onAssign={() => setModal({ student: s, slot })}
                onEdit={() => setModal({ student: s, slot })}
                onRemove={() => window.confirm(`Remove Project ${slot.number} (“${slot.title}”) from ${s.name}?`) && remove.mutate({ method: 'delete', url: `/v2/staff/real-world-projects/${slot.assignment_id}` })} />
            ))}
          </div>
        </Card>
      ))}
      {modal && <RwpModal student={modal.student} slot={modal.slot} onClose={() => setModal(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ advanced / career: 1 task or project per student */
const FORM_CHIP = {
  submitted: ['Form submitted', 'bg-emerald-50 text-emerald-700'], draft: ['Form in draft', 'bg-amber-50 text-amber-700'],
  not_started: ['Form not started', 'bg-slate-100 text-slate-500'], locked: ['Form locked', 'bg-slate-100 text-slate-500'],
  completed: ['Form filled · accepted', 'bg-emerald-50 text-emerald-700'], revision_required: ['Form filled · changes requested', 'bg-red-50 text-red-700'],
}
const REVIEW_CHIP = { accepted: ['Accepted', 'bg-emerald-50 text-emerald-700'], under_review: ['Under review', 'bg-sky-50 text-sky-700'],
  revision_required: ['Changes requested', 'bg-red-50 text-red-700'], pending: ['Awaiting review', 'bg-amber-50 text-amber-700'] }

function SingleAssignTab({ tier }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(null)
  const [modal, setModal] = useState(null)
  const [selId, setSelId] = useState(null)
  const key = ['v2', 'forms', tier]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get(`/v2/staff/work/${tier}/forms`).then((r) => r.data), refetchInterval: 30000 })
  const remove = useSave([['v2']], 'Assigned work removed')
  if (isLoading || !data) return <Spinner />
  const ready = (s) => s.form_id && s.form_status !== 'draft'
  const needs = (s) => (s.attention || []).length > 0
  const counts = { all: data.length, attention: data.filter(needs).length, todo: data.filter((s) => ready(s) && !s.assignment).length, waiting: data.filter((s) => !ready(s)).length, done: data.filter((s) => s.assignment).length }
  const term = q.trim().toLowerCase()
  const ts = (v) => (v ? new Date(v).getTime() : 0)
  const rows = data
    .filter((s) => filter === 'all' || (filter === 'attention' ? needs(s) : filter === 'todo' ? ready(s) && !s.assignment : filter === 'waiting' ? !ready(s) : !!s.assignment))
    .filter((s) => !term || `${s.name} ${s.student_number} ${s.email}`.toLowerCase().includes(term))
    .sort((x, y) => (needs(y) - needs(x)) || ((y.unread_messages || 0) - (x.unread_messages || 0)) || (ts(y.last_student_activity) - ts(x.last_student_activity)) || x.name.localeCompare(y.name))
  const s = rows.find((r) => r.enrollment_id === selId) || null
  const Chip = ([label, cls]) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const a = s?.assignment
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {[['all', 'All students'], ['attention', 'Needs attention'], ['todo', 'Ready to assign'], ['waiting', 'Waiting for form'], ['done', 'Assigned']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${filter === k ? 'bg-violet-600 font-medium text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {l} <span className={filter === k ? 'text-violet-100' : k === 'attention' && counts.attention ? 'font-semibold text-red-600' : 'text-slate-400'}>{counts[k]}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student name or ID…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-72" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Student list */}
        <Card className="overflow-hidden p-0 lg:sticky lg:top-4 lg:self-start">
          {rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{data.length ? 'No students in this view.' : `No ${tierLabel(tier)} students yet.`}</p> : (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {rows.map((r) => {
                const on = r.enrollment_id === selId
                const status = r.assignment ? (r.assignment.versions ? r.assignment.status_label : 'Assigned · not submitted') : ready(r) ? 'Ready to assign' : 'Waiting for form'
                return (
                  <li key={r.enrollment_id}>
                    <button onClick={() => setSelId(r.enrollment_id)} style={{ transform: 'none', boxShadow: 'none' }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${on ? 'bg-violet-50' : needs(r) ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
                      <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${on ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700'}`}>
                        {initials(r.name)}
                        {needs(r) && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{r.name}</span>
                        <span className="block truncate text-xs text-slate-500">{needs(r) ? <b className="font-medium text-amber-700">{r.attention.join(' · ')}</b> : `ID ${r.student_number} · ${status}`}</span>
                      </span>
                      {r.unread_messages > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">{r.unread_messages}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Detail */}
        {!s ? (
          <Card className="flex min-h-[320px] flex-col items-center justify-center gap-1 p-8 text-center text-sm text-slate-500">
            <span className="font-semibold text-slate-700">Select a student</span>
            <span>Their form, resume, assigned work and messages appear here. Students needing attention are listed first.</span>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">{initials(s.name)}</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/enrollments/${s.enrollment_id}`} className="text-lg font-semibold text-slate-900 hover:text-brand-700">{s.name}</Link>
                  <p className="truncate text-xs text-slate-500">ID {s.student_number} · {s.email}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Chip(FORM_CHIP[s.form_status] || FORM_CHIP.not_started)}
                  {['submitted', 'completed'].includes(s.form_status) && s.review_status && s.review_status !== 'accepted' && Chip(REVIEW_CHIP[s.review_status] || ['Review: ' + humanize(s.review_status), 'bg-slate-100 text-slate-600'])}
                </div>
              </div>
              {needs(s) && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><b>Needs attention:</b> {s.attention.join(' · ')}</p>}
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-400">Area of interest</dt><dd className="text-slate-700">{s.area_of_interest || '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-400">Resume</dt><dd className="text-slate-700">{s.resume_count ? `${s.resume_count} version${s.resume_count > 1 ? 's' : ''} uploaded` : '—'}</dd></div>
              </dl>
              {ready(s) && <Button variant="secondary" className="mt-4" onClick={() => setForm(s.form_id)}>Review form & resume</Button>}
            </Card>

            {a ? (
              <Card className="p-5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-violet-600">Assigned {a.work_type === 'project' ? 'project' : 'task'}</span>
                  <Status value={a.status || 'in_progress'} label={a.versions ? a.status_label : 'Not submitted'} />
                </div>
                <p className="font-semibold leading-snug text-slate-900">{a.title}</p>
                {a.technology && <p className="text-xs text-slate-500">{a.technology}</p>}
                {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                <p className="mt-1 text-xs text-slate-500">{a.deadline ? `Due ${fmtDate(a.deadline)}` : 'No due date'} · assigned {fmtDate(a.assigned_at)}{a.resource_file_name ? ` · 📎 ${a.resource_file_name}` : ''}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <button className="font-medium text-brand-700 hover:underline" onClick={() => setModal({ student: s, slot: { ...a, number: 1 } })}>Edit</button>
                  <ResourceUpload projectId={a.project_id} />
                  <button className="text-red-600 hover:underline" onClick={() => window.confirm(`Remove “${a.title}” from ${s.name}? You can then assign something else.`) && remove.mutate({ method: 'delete', url: `/v2/staff/assigned-work/${a.assignment_id}` })}>Remove</button>
                </div>
              </Card>
            ) : ready(s) ? (
              <button onClick={() => setModal({ student: s, slot: { number: 1 } })}
                className="flex min-h-[140px] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-4 text-sm text-violet-700 transition hover:border-violet-400 hover:bg-violet-50">
                <Plus size={22} />
                <span className="font-semibold">Assign task or project</span>
                <span className="text-xs text-slate-500">Form submitted — ready for work</span>
              </button>
            ) : (
              <div className="flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                <span className="font-medium">Waiting for the student’s internship form</span>
                <span className="text-xs">You can assign work once they submit their form and resume.</span>
              </div>
            )}

            {a?.latest_submission_id && (
              <FeedbackChat key={a.latest_submission_id} me="staff" queryKey={['v2', 'feedback', a.latest_submission_id]}
                listUrl={`/v2/staff/submissions/${a.latest_submission_id}/messages`} postUrl={`/v2/staff/submissions/${a.latest_submission_id}/messages`}
                title={`Messages with ${s.name}`} emptyText="No messages yet." />
            )}
          </div>
        )}
      </div>
      {form && <FormModal formId={form} onClose={() => setForm(null)} />}
      {modal && <RwpModal mode="single" tier={tier} student={modal.student} slot={modal.slot} onClose={() => setModal(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ eligibility */
const ELIG_STATES = [['met', 'Met', 'border-emerald-600 bg-emerald-600 text-white'], ['not_met', 'Not met', 'border-red-600 bg-red-600 text-white'],
  ['waived', 'Waived', 'border-sky-600 bg-sky-600 text-white'], ['pending', 'Pending', 'border-slate-500 bg-slate-500 text-white']]

function CriterionRow({ c, onSave, saving }) {
  const [pick, setPick] = useState(null)
  const [reason, setReason] = useState('')
  const open = pick !== null
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-medium text-slate-900">{c.description}</p>
          {c.reason && c.reason !== 'Initial state' && <p className="mt-0.5 text-xs text-slate-500">“{c.reason}”{c.changed_at ? ` · ${fmtDateTime(c.changed_at)}` : ''}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          {ELIG_STATES.map(([k, l, on]) => (
            <button key={k} type="button" onClick={() => { setPick(k === c.state && !open ? null : k); setReason('') }}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${(open ? pick : c.state) === k ? on : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-start gap-2 rounded-lg bg-slate-50 p-2">
          <textarea rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Feedback / reason (shown to the student, saved in the audit log)"
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex gap-1.5">
            <Button disabled={reason.trim().length < 3 || saving} onClick={() => onSave(c.code, pick, reason.trim(), () => setPick(null))}>Save</Button>
            <Button variant="ghost" onClick={() => setPick(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  )
}

export function EligibilityTab() {
  const [selected, setSelected] = useState(null)
  const [q, setQ] = useState('')
  const { data: students } = useQuery({ queryKey: ['v2', 'students', 'accelerator'], queryFn: () => apiClient.get('/v2/staff/students', { params: { tier: 'accelerator' } }).then((r) => r.data.students) })
  const key = ['v2', 'eligibility', selected]
  const { data, isLoading } = useQuery({ queryKey: key, enabled: !!selected, queryFn: () => apiClient.get(`/v2/staff/enrollments/${selected}/eligibility`).then((r) => r.data) })
  const save = useSave([key, ['v2', 'students']], 'Eligibility updated')
  const term = q.trim().toLowerCase()
  const list = (students || []).filter((s) => s.status !== 'pending_payment' && (!term || `${s.name} ${s.student_number} ${s.email || ''}`.toLowerCase().includes(term)))
  const current = (students || []).find((s) => s.enrollment_id === selected)
  const onSave = (code, state, reason, done) => save.mutate({ url: `/v2/staff/enrollments/${selected}/eligibility`, body: { criterion_code: code, state, reason } }, { onSuccess: done })
  const auto = data?.criteria.filter((c) => c.automatic) || []
  const manual = data?.criteria.filter((c) => !c.automatic) || []
  const p = data?.progress
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit p-3">
        <div className="relative mb-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
        </div>
        <div className="max-h-[65vh] space-y-0.5 overflow-y-auto">
          {list.map((s) => (
            <button key={s.enrollment_id} onClick={() => setSelected(s.enrollment_id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${selected === s.enrollment_id ? 'bg-brand-50 font-medium text-brand-800' : 'hover:bg-slate-50'}`}>
              {s.name}<span className="block text-xs text-slate-400">ID {s.student_number}</span>
            </button>
          ))}
          {!list.length && <p className="p-4 text-sm text-slate-500">{students?.length ? 'No students match.' : 'No Career Accelerator students.'}</p>}
        </div>
      </Card>
      <div>
        {!selected ? <Card className="p-10 text-center text-sm text-slate-500">Select a student to review and update their placement eligibility.</Card> : isLoading || !data ? <Spinner /> : (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-lg font-semibold text-slate-900">{current?.name}</p><p className="text-xs text-slate-500">ID {current?.student_number}</p></div>
                <div className="flex items-center gap-2 text-sm text-slate-600">Overall <Status value={data.overall} /></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Assignments', `${p.assignments_completed}/22`], ['Real-world projects', `${p.projects_completed}/3`], ['Total work', `${p.total_completed}/25`], ['Mock interviews', `${p.mock_interviews_completed}/3`]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 text-center"><p className="text-xs text-slate-500">{k}</p><p className="text-lg font-semibold">{v}</p></div>
                ))}
              </div>
            </Card>
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-800">Staff assessment</p>
                <p className="text-xs text-slate-500">Your feedback on each point. Pick a result, write a short reason, then Save.</p>
              </div>
              <ul className="divide-y divide-slate-100">{manual.map((c) => <CriterionRow key={c.code} c={c} onSave={onSave} saving={save.isPending} />)}</ul>
            </Card>
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-800">Automatic checks</p>
                <p className="text-xs text-slate-500">Updated automatically from the student's progress. Override only if needed (Waive or Pending; Met / Not met needs an Admin).</p>
              </div>
              <ul className="divide-y divide-slate-100">{auto.map((c) => <CriterionRow key={c.code} c={c} onSave={onSave} saving={save.isPending} />)}</ul>
            </Card>
            {data.history.length > 0 && (
              <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold uppercase text-slate-500">Decision history ({data.history.length})</summary>
                <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                  {data.history.map((h, i) => <li key={i}>{fmtDateTime(h.at)} · {h.by} · {humanize(h.criterion)}: {humanize(h.from)} → <b>{humanize(h.to)}</b> · {h.reason}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function EligibilityPage() {
  return (
    <div>
      <PageHeader title="Career Accelerator · Placement Eligibility" subtitle="Record feedback on each placement-guarantee point. Students see the result and your reason on their Placement Eligibility page." />
      <EligibilityTab />
    </div>
  )
}

/* ------------------------------------------------------------------ evaluation */
const FIELD_INPUT = {
  mcq_score: ['number', 'MCQ score'], project_grade: ['number', 'Project grade (0–100)'], project1_grade: ['number', 'Project 1 grade'],
  project2_grade: ['number', 'Project 2 grade'], form_review: ['select:pending,accepted,revision_required', 'Form / resume review'],
  work_quality: ['rating', 'Submission quality (1–5)'], performance_rating: ['rating', 'Internship performance (1–5)'],
  mock_interview_rating: ['rating', 'Mock interview (1–5)'], internship_performance: ['rating', 'Internship performance (1–5)'],
  deadline_compliance: ['select:good,warning,poor', 'Deadline compliance'], professional_conduct: ['select:good,warning,poor', 'Professional conduct'],
  integrity: ['select:good,warning,poor', 'Academic / professional integrity'], confidentiality: ['select:good,warning,poor', 'Confidentiality'],
  eligibility_decision: ['select:eligible,not_eligible,pending', 'Placement eligibility decision'],
}

function EvaluationModal({ tier, row, fields, onClose }) {
  const { data } = useQuery({ queryKey: ['v2', 'evaluation', tier, row.enrollment_id], queryFn: () => apiClient.get(`/v2/staff/evaluations/${tier}/${row.enrollment_id}`).then((r) => r.data) })
  const last = data?.history?.[0]
  const [f, setF] = useState(null)
  const save = useSave([['v2']], 'Evaluation saved')
  if (!data) return <Modal open onClose={onClose} title="Loading…"><Spinner /></Modal>
  const values = f ?? { result: last?.result || 'in_progress', remarks: '', ...Object.fromEntries(fields.map((k) => [k, last?.[k] ?? ''])) }
  const set = (k) => (e) => setF({ ...values, [k]: e.target.value })
  const submit = () => {
    const payload = { result: values.result, remarks: values.remarks || null, values: {} }
    fields.forEach((k) => {
      const kind = FIELD_INPUT[k][0]
      const v = values[k]
      payload.values[k] = v === '' || v == null ? null : (kind === 'number' || kind === 'rating') ? Number(v) : v
    })
    save.mutate({ url: `/v2/staff/evaluations/${tier}/${row.enrollment_id}`, body: payload }, { onSuccess: onClose })
  }
  return (
    <Modal open wide onClose={onClose} title={`Evaluate – ${row.name}`} footer={<Button onClick={submit}>Save evaluation</Button>}>
      <div className="space-y-5">
        {data.mcq && <p className="text-sm"><b>MCQ:</b> {data.mcq.attempts ? `${data.mcq.correct}/${data.mcq.total} (${data.mcq.percentage}%) – ${data.mcq.status}` : 'Not attempted'}</p>}
        <Table keyField="label" rows={data.work} emptyMessage="No work items." columns={[
          { key: 'label', header: 'Work' }, { key: 'title', header: 'Title' }, { key: 'status_label', header: 'Status' },
          { key: 'versions', header: 'Versions' }, { key: 'grade', header: 'Grade' },
        ]} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((k) => {
            const [kind, label] = FIELD_INPUT[k]
            if (kind.startsWith('select:')) return <Select key={k} label={label} value={values[k] ?? ''} onChange={set(k)}><option value="">—</option>{kind.slice(7).split(',').map((o) => <option key={o} value={o}>{humanize(o)}</option>)}</Select>
            if (kind === 'rating') return <Select key={k} label={label} value={values[k] ?? ''} onChange={set(k)}><option value="">—</option>{[1, 2, 3, 4, 5].map((o) => <option key={o} value={o}>{o}</option>)}</Select>
            return <Input key={k} label={label} type="number" value={values[k] ?? ''} onChange={set(k)} />
          })}
          <Select label="Result / completion status" value={values.result} onChange={set('result')}>{['pending', 'in_progress', 'passed', 'failed', 'completed', 'incomplete'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select>
          <div className="sm:col-span-2"><TextArea label="Instructor / admin remarks" value={values.remarks} onChange={set('remarks')} rows={3} /></div>
        </div>
        {data.history.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Evaluation history (kept permanently)</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {data.history.map((h) => <li key={h.id}>{fmtDateTime(h.at)} · {h.evaluator} · <b>{humanize(h.result)}</b>{h.remarks ? ` · ${h.remarks}` : ''}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}


/* ------------------------------------------------------------------ student progress report */
function buildReport(tier, row) {
  const p = row.progress || {}
  const checks = []
  const add = (group, label, state, detail) => checks.push({ group, label, state, detail })
  const mcq = p.mcq
  if (['basic', 'professional'].includes(tier)) {
    if (mcq == null) add('Assessment', 'MCQ assessment', 'done', 'No MCQ configured for this programme')
    else if (!mcq.attempts) add('Assessment', 'MCQ assessment', 'pending', 'Not attempted yet')
    else if (mcq.passed) add('Assessment', 'MCQ assessment', 'done', `Passed · ${mcq.correct}/${mcq.total} (${Math.round(mcq.percentage)}%)`)
    else if (mcq.in_progress) add('Assessment', 'MCQ assessment', 'pending', 'Attempt in progress')
    else add('Assessment', 'MCQ assessment', 'failed', `Not passed · best ${mcq.correct ?? 0}/${mcq.total ?? '—'} (${Math.round(mcq.percentage ?? 0)}%) · ${mcq.attempts} attempt(s)${mcq.terminated ? ` · ${mcq.terminated} terminated` : ''}`)
    add('Project', 'Project selection', p.selection_confirmed ? 'done' : 'pending', p.selection_confirmed ? 'Confirmed and locked' : 'Student has not confirmed a project yet')
  }
  if (['advanced', 'career'].includes(tier)) {
    const fs = p.form_status || 'not_started'
    add('Internship', 'Internship form', fs === 'not_started' || fs === 'draft' ? 'pending' : 'done', humanize(fs))
    if (!p.assigned) add('Work', 'Assigned work', 'pending', 'No work assigned yet')
  }
  if (tier === 'career') {
    const m = p.mock_interview_status || 'not_scheduled'
    add('Interview', 'Mock interview', m === 'completed' ? 'done' : 'pending', humanize(m))
  }
  if (tier === 'accelerator') {
    const cnt = (label, a, b) => add('Requirements', label, a >= b ? 'done' : 'pending', `${a ?? 0} of ${b} completed`)
    cnt('Technical assignments', p.assignments_completed, p.assignments_required || 22)
    cnt('Real-world projects', p.projects_completed, p.projects_required || 3)
    cnt('Mock interviews', p.mock_interviews_completed, p.mock_interviews_required || 3)
    const fs = p.internship_form_status || 'not_started'
    add('Requirements', 'Internship form', fs === 'not_started' || fs === 'draft' ? 'pending' : 'done', humanize(fs))
    add('Requirements', 'Placement eligibility', p.eligibility_status === 'eligible' ? 'done' : p.eligibility_status === 'not_eligible' ? 'failed' : 'pending', humanize(p.eligibility_status || 'pending'))
  }
  const now = Date.now()
  ;(p.items || []).forEach((i) => {
    const name = i.title || i.label
    const overdue = i.deadline && new Date(i.deadline).getTime() < now
    if (i.status === 'graded') add('Work', name, 'done', `Completed${i.versions > 1 ? ` after ${i.versions} versions` : ''}`)
    else if (i.locked) add('Work', name, 'pending', 'Not open yet')
    else if (i.status === 'revision_requested') add('Work', name, 'failed', `Revision required (v${i.versions})${i.latest_feedback ? ` — “${i.latest_feedback}”` : ''}`)
    else if (i.status === 'submitted' || i.status === 'under_review') add('Work', name, 'pending', `Awaiting review (v${i.versions})`)
    else add('Work', name, overdue ? 'failed' : 'pending', overdue ? `Not submitted — deadline passed ${fmtDate(i.deadline)}` : `Not submitted${i.deadline ? ` · due ${fmtDate(i.deadline)}` : ''}`)
  })
  const ev = row.evaluation
  add('Final', 'Final evaluation', ev && ['passed', 'completed'].includes(ev.result) ? 'done' : ev && ['failed', 'incomplete'].includes(ev.result) ? 'failed' : 'pending',
    ev ? `${humanize(ev.result)} · ${fmtDate(ev.at)}` : 'Not evaluated yet')
  const by = (st) => checks.filter((c) => c.state === st)
  return { checks, done: by('done'), pending: by('pending'), failed: by('failed') }
}

const STATE_STYLE = {
  done: ['✓', 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Done'],
  pending: ['…', 'bg-amber-50 text-amber-700 border-amber-200', 'Pending'],
  failed: ['✗', 'bg-red-50 text-red-700 border-red-200', 'Needs attention'],
}

function StudentReport({ tier, row, onClose }) {
  const r = buildReport(tier, row)
  const p = row.progress || {}
  return (
    <Modal open wide onClose={onClose} title={`Progress report · ${row.name}`}>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600">
          <span>Student ID <b className="text-slate-900">{row.student_number}</b></span>
          {row.email && <span>{row.email}</span>}
          <span>Workflow <Status value={p.track_status} /></span>
        </div>
        <div><Progress value={p.percent} /></div>
        <div className="grid grid-cols-3 gap-3">
          {[['done', r.done.length], ['pending', r.pending.length], ['failed', r.failed.length]].map(([k, n]) => (
            <div key={k} className={`rounded-xl border p-3 ${STATE_STYLE[k][1]}`}>
              <p className="text-2xl font-bold">{n}</p><p className="text-xs font-semibold uppercase tracking-wide">{STATE_STYLE[k][2]}</p>
            </div>
          ))}
        </div>
        {r.failed.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-1 font-semibold text-red-800">Where the student is stuck</p>
            <ul className="list-disc space-y-0.5 pl-5 text-red-700">{r.failed.map((c, i) => <li key={i}><b>{c.label}:</b> {c.detail}</li>)}</ul>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Area</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Details</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {r.checks.map((c, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-xs text-slate-500">{c.group}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{c.label}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${STATE_STYLE[c.state][1]}`}>{STATE_STYLE[c.state][0]} {STATE_STYLE[c.state][2]}</span></td>
                  <td className="px-3 py-2 text-slate-600">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {row.evaluation?.remarks && <p className="rounded-xl bg-slate-50 p-3 text-slate-700"><b>Latest remarks:</b> {row.evaluation.remarks}</p>}
      </div>
    </Modal>
  )
}

function exportReportCsv(tier, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Student ID', 'Name', 'Email', 'Progress %', 'Workflow', 'Done', 'Pending items', 'Needs attention', 'Latest evaluation']
  const lines = rows.map((row) => {
    const r = buildReport(tier, row)
    return [row.student_number, row.name, row.email, row.progress?.percent ?? 0, row.progress?.track_status,
      r.done.length, r.pending.map((c) => `${c.label} (${c.detail})`).join('; '), r.failed.map((c) => `${c.label} (${c.detail})`).join('; '),
      row.evaluation ? `${row.evaluation.result} ${fmtDate(row.evaluation.at)}` : 'Not evaluated'].map(esc).join(',')
  })
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `${tier}-progress-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function EvaluationTab({ tier }) {
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name_asc')
  const [report, setReport] = useState(null)
  const { data, isLoading } = useQuery({ queryKey: ['v2', 'evaluations', tier], queryFn: () => apiClient.get(`/v2/staff/evaluations/${tier}`).then((r) => r.data) })
  const rows = (() => {
    if (!data) return []
    const t = q.trim().toLowerCase()
    const list = data.rows.filter((r) => !t || [r.name, r.student_number, r.email].some((v) => String(v ?? '').toLowerCase().includes(t)))
    const pct = (r) => r.progress?.percent ?? 0
    const at = (r) => (r.evaluation?.at ? new Date(r.evaluation.at).getTime() : 0)
    const cmp = {
      name_asc: (a, b) => String(a.name).localeCompare(String(b.name)),
      name_desc: (a, b) => String(b.name).localeCompare(String(a.name)),
      id_asc: (a, b) => String(a.student_number).localeCompare(String(b.student_number), undefined, { numeric: true }),
      progress_desc: (a, b) => pct(b) - pct(a),
      progress_asc: (a, b) => pct(a) - pct(b),
      eval_recent: (a, b) => at(b) - at(a),
      not_evaluated: (a, b) => (a.evaluation ? 1 : 0) - (b.evaluation ? 1 : 0) || String(a.name).localeCompare(String(b.name)),
    }[sort]
    return [...list].sort(cmp)
  })()
  return (
    <Card>
      {isLoading || !data ? <Spinner /> : (<>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, student ID or email…"
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Search students" />
          <label className="flex items-center gap-2 text-sm text-slate-600">Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="id_asc">Student ID</option>
              <option value="progress_desc">Progress (high → low)</option>
              <option value="progress_asc">Progress (low → high)</option>
              <option value="eval_recent">Latest evaluation (newest)</option>
              <option value="not_evaluated">Not evaluated first</option>
            </select>
          </label>
          <span className="text-xs text-slate-500">{rows.length} of {data.rows.length} students</span>
          <Button variant="secondary" disabled={!rows.length} onClick={() => exportReportCsv(tier, rows)}><Download size={15} /> Download report (CSV)</Button>
        </div>
        <Table
          keyField="enrollment_id"
          rows={rows}
          emptyMessage={q.trim() ? `No students match “${q.trim()}”.` : 'No students to evaluate yet.'}
          columns={[
            { key: 'student_number', header: 'Student ID' }, { key: 'name', header: 'Student' },
            { key: 'progress', header: 'Progress', render: (r) => {
              const p = r.progress || {}
              const sel = ['basic', 'professional'].includes(tier)
              const chip = (ok, label) => <span key={label} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{ok ? '✓' : '✗'} {label}</span>
              return (
                <div className="space-y-1">
                  <Progress value={p.percent} />
                  {sel && <div className="flex flex-wrap gap-1">
                    {chip(p.mcq == null || !!p.mcq?.passed, p.mcq == null ? 'MCQ n/a' : p.mcq?.passed ? 'MCQ passed' : `MCQ ${p.mcq?.attempts ? 'not passed' : 'not attempted'}`)}
                    {chip(!!p.selection_confirmed, 'Selection')}
                    {chip(p.projects_completed === p.projects_required, `Project${p.projects_required > 1 ? 's' : ''} ${p.projects_completed ?? 0}/${p.projects_required ?? 1} approved`)}
                  </div>}
                </div>
              )
            } },
            { key: 'track', header: 'Workflow', render: (r) => <Status value={r.progress.track_status} /> },
            { key: 'result', header: 'Latest evaluation', render: (r) => (r.evaluation ? <><Status value={r.evaluation.result} /> <span className="text-xs text-slate-400">{fmtDate(r.evaluation.at)}</span></> : '—') },
            { key: 'open', header: '', render: (r) => <div className="flex gap-2"><Button variant="secondary" onClick={() => setReport(r)}><FileText size={15} /> Report</Button><Button variant="secondary" onClick={() => setOpen(r)}>Evaluate</Button></div> },
          ]}
        />
      </>)}
      {open && <EvaluationModal tier={tier} row={open} fields={data.fields} onClose={() => setOpen(null)} />}
      {report && <StudentReport tier={tier} row={report} onClose={() => setReport(null)} />}
    </Card>
  )
}


/* ------------------------------------------------------------------ separate sidebar pages */
export function EvaluatePage() {
  const { tier } = useParams()
  const [params, setParams] = useSearchParams()
  const tabs = [['submissions', 'Submissions'], ['final', 'Final Evaluation'], ...(tier === 'accelerator' ? [['eligibility', 'Placement Eligibility']] : [])]
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'submissions'
  return (
    <div>
      <PageHeader title={`${tierLabel(tier)} · Submissions & Evaluation`} subtitle="Review submitted work in one tab; record each student's final evaluation in the other." />
      <div className="mb-5 flex gap-1 border-b border-slate-200" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>
        ))}
      </div>
      {tab === 'submissions' && <><SectionTitle title="Submissions" text="Open a submission to give marks and feedback, then approve or request a revision." /><SubmissionsTab key={`s-${tier}`} tier={tier} /></>}
      {tab === 'final' && <><SectionTitle title="Final Evaluation" text="Overall marks and remarks for each student. Progress counts the MCQ, the project selection and each approved project." /><EvaluationTab key={`e-${tier}`} tier={tier} /></>}
      {tab === 'eligibility' && <><SectionTitle title="Placement Eligibility" /><EligibilityTab /></>}
    </div>
  )
}

export function MockInterviewsPage() {
  const { tier } = useParams()
  if (!['career', 'accelerator'].includes(tier)) return <Navigate to="/mock-interviews/career" replace />
  return (
    <div>
      <PageHeader title={`${tierLabel(tier)} · Mock Interviews`}
        subtitle={tier === 'career' ? 'One mock interview per student: schedule it, then record feedback and the result.' : 'Three mock interviews per student: schedule each one, then record feedback and the result.'} />
      <MocksTab key={tier} tier={tier} />
    </div>
  )
}


export function SelectionsPage() {
  const { tier } = useParams()
  if (!['basic', 'professional'].includes(tier)) return <Navigate to="/selections/basic" replace />
  return (
    <div>
      <PageHeader title={`${tierLabel(tier)} · Student Selections`}
        subtitle={`Which project${tier === 'basic' ? '' : 's'} each student picked (${tier === 'basic' ? '1' : '2'} per student). Selections lock once confirmed; use Reset / change to let a student choose again.`} />
      <SelectionsTab key={tier} tier={tier} />
      <p className="mt-4 text-sm text-slate-500">Projects are managed in <Link className="font-medium text-brand-700 hover:underline" to={`/work/${tier}?tab=project_questions`}>Work Management → {tierLabel(tier)} → Project Questions</Link>.</p>
    </div>
  )
}


export function McqResultsPage() {
  const { tier } = useParams()
  if (!['basic', 'professional'].includes(tier)) return <Navigate to="/mcq-results/basic" replace />
  return (
    <div>
      <PageHeader title={`${tierLabel(tier)} · MCQ Results`} subtitle="Best score per student. Scores appear automatically after students attempt the MCQ." />
      <McqTab key={tier} tier={tier} />
      <p className="mt-4 text-sm text-slate-500">Questions and MCQ settings are in <Link className="font-medium text-brand-700 hover:underline" to={`/work/${tier}?tab=questions`}>Work Management → {tierLabel(tier)} → Questions</Link>.</p>
    </div>
  )
}
