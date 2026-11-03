import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ExternalLink, FileUp, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import Table from '../../components/ui/Table'
import { Status, TextArea } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { downloadFile, errorText, fmtDate, humanize } from '../../lib/v2'

const TIER_CODE = { basic: 'basic', professional: 'professional', advanced: 'advanced', career: 'career', accelerator: 'career_accelerator' }

export function SectionTitle({ title, text, actions }) {
  return (
    <div className="mb-3 mt-6 flex flex-wrap items-end justify-between gap-3 first:mt-0">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {text && <p className="text-sm text-slate-500">{text}</p>}
      </div>
      {actions}
    </div>
  )
}

/* ================================================================== MCQ questions */
const EMPTY_Q = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '' }

export function QuestionsSection({ tier }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const key = ['v2', 'questions', tier]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get(`/v2/staff/work/${tier}/questions`).then((r) => r.data) })
  const [edit, setEdit] = useState(null)
  const [settings, setSettings] = useState(null)
  const done = (msg) => ({ onSuccess: (r) => { push(typeof msg === 'function' ? msg(r) : msg, 'success'); setEdit(null); setSettings(null); qc.invalidateQueries({ queryKey: key }) }, onError: (e) => push(errorText(e), 'error') })
  const save = useMutation({ mutationFn: (q) => (q.id ? apiClient.put(`/v2/staff/work/${tier}/questions/${q.id}`, q) : apiClient.post(`/v2/staff/work/${tier}/questions`, q)), ...done('Question saved') })
  const remove = useMutation({ mutationFn: (id) => apiClient.delete(`/v2/staff/work/${tier}/questions/${id}`), ...done('Question deleted') })
  const upload = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('file', file); return apiClient.post(`/v2/staff/work/${tier}/questions/upload`, fd).then((r) => r.data) },
    ...done((r) => `${r.added} questions added${r.skipped ? ` (${r.skipped} rows skipped)` : ''}`),
  })
  const saveSettings = useMutation({ mutationFn: (body) => apiClient.put(`/v2/staff/work/${tier}/questions/settings`, body), ...done('Settings saved') })

  if (isLoading || !data) return <Spinner />
  const s = data.settings
  const count = data.questions.length
  const short = s && count < s.questions_per_attempt
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })

  return (
    <div>
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="space-y-1">
          <p>
            <b>{count}</b> question{count === 1 ? '' : 's'} in this program’s bank.
            {s && <> Each attempt shows <b>{s.questions_per_attempt}</b> random questions · pass mark <b>{s.passing_percent}%</b> · <b>{s.time_limit_minutes}</b> min · up to <b>{s.max_attempts}</b> attempts.</>}
          </p>
          {short && <p className="text-amber-700">Add at least {s.questions_per_attempt - count} more question(s), or lower “questions per attempt”, before students can start.</p>}
          {!data.always_on && <p className={data.enabled ? 'text-emerald-700' : 'text-slate-500'}>MCQ is {data.enabled ? 'ON' : 'OFF'} for {humanize(tier)} students.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSettings({ enabled: data.enabled, ...(s || { questions_per_attempt: 20, passing_percent: 60, time_limit_minutes: 30, max_attempts: 3, attempts_per_day: 1 }) })}>Settings</Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
            <FileUp size={16} /> {upload.isPending ? 'Uploading…' : 'Upload Excel'}
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload.mutate(f) }} />
          </label>
          <Button onClick={() => setEdit({ ...EMPTY_Q })}><Plus size={16} /> Add question</Button>
        </div>
      </Card>
      <p className="mb-3 text-xs text-slate-500">Excel format: column A question, B–E options A–D, F correct letter (A/B/C/D). A header row is skipped automatically.</p>

      <Card>
        <Table
          rows={data.questions}
          emptyMessage="No questions yet. Add one, or upload an Excel sheet."
          columns={[
            { key: 'n', header: '#', render: (r) => data.questions.indexOf(r) + 1 },
            { key: 'question_text', header: 'Question', render: (r) => <span className="line-clamp-2 max-w-xl">{r.question_text}</span> },
            { key: 'correct_option', header: 'Answer', render: (r) => <span className="font-semibold">{r.correct_option}. <span className="font-normal text-slate-600">{r[`option_${r.correct_option.toLowerCase()}`]}</span></span> },
            {
              key: 'a', header: '', render: (r) => (
                <div className="flex gap-3">
                  <button title="Edit" className="text-slate-500 hover:text-brand-700" onClick={() => setEdit({ ...r, explanation: r.explanation || '' })}><Pencil size={15} /></button>
                  <button title="Delete" className="text-slate-500 hover:text-red-600" onClick={() => { if (window.confirm('Delete this question?')) remove.mutate(r.id) }}><Trash2 size={15} /></button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? 'Edit question' : 'Add question'}
        footer={<Button disabled={save.isPending || !edit?.question_text || !edit?.option_a || !edit?.option_b || !edit?.option_c || !edit?.option_d} onClick={() => save.mutate({ ...edit, explanation: edit.explanation || null })}>Save question</Button>}>
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><TextArea label="Question" rows={3} value={edit.question_text} onChange={set('question_text')} /></div>
            {['a', 'b', 'c', 'd'].map((o) => <Input key={o} label={`Option ${o.toUpperCase()}`} value={edit[`option_${o}`]} onChange={set(`option_${o}`)} />)}
            <Select label="Correct answer" value={edit.correct_option} onChange={set('correct_option')}>{['A', 'B', 'C', 'D'].map((o) => <option key={o} value={o}>Option {o}</option>)}</Select>
            <div className="sm:col-span-2"><TextArea label="Explanation (optional)" rows={2} value={edit.explanation} onChange={set('explanation')} /></div>
          </div>
        )}
      </Modal>

      <Modal open={!!settings} onClose={() => setSettings(null)} title="MCQ settings"
        footer={<Button disabled={saveSettings.isPending} onClick={() => saveSettings.mutate({ ...(data.always_on ? {} : { enabled: settings.enabled }), questions_per_attempt: Number(settings.questions_per_attempt), passing_percent: Number(settings.passing_percent), time_limit_minutes: Number(settings.time_limit_minutes), max_attempts: Number(settings.max_attempts), attempts_per_day: Number(settings.attempts_per_day) })}>Save settings</Button>}>
        {settings && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!data.always_on && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} /> Show the MCQ to {humanize(tier)} students</label>
            )}
            <Input label="Questions per attempt" type="number" value={settings.questions_per_attempt} onChange={(e) => setSettings({ ...settings, questions_per_attempt: e.target.value })} />
            <Input label="Pass mark (%)" type="number" value={settings.passing_percent} onChange={(e) => setSettings({ ...settings, passing_percent: e.target.value })} />
            <Input label="Time limit (minutes)" type="number" value={settings.time_limit_minutes} onChange={(e) => setSettings({ ...settings, time_limit_minutes: e.target.value })} />
            <Input label="Maximum attempts" type="number" value={settings.max_attempts} onChange={(e) => setSettings({ ...settings, max_attempts: e.target.value })} />
            <Input label="Attempts per day" type="number" value={settings.attempts_per_day} onChange={(e) => setSettings({ ...settings, attempts_per_day: e.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ================================================================== study materials / videos */
export function MaterialsSection({ tier, videos = false }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const [edit, setEdit] = useState(null)
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const { data: programs } = useQuery({ queryKey: ['v2', 'programs'], queryFn: () => apiClient.get('/v2/staff/programs').then((r) => r.data) })
  const program = (programs || []).find((p) => p.code === TIER_CODE[tier])
  const { data: all, isLoading } = useQuery({
    queryKey: ['materials', program?.id], enabled: !!program,
    queryFn: () => apiClient.get('/materials', { params: { program_id: program.id } }).then((r) => r.data),
  })
  const rows = (all || []).filter((m) => (videos ? m.content_type === 'video' : m.content_type !== 'video'))
  const opts = (msg) => ({ onSuccess: () => { push(msg, 'success'); setEdit(null); setFile(null); setProgress(null); qc.invalidateQueries({ queryKey: ['materials'] }) }, onError: (e) => { setProgress(null); push(errorText(e), 'error') } })
  const onUploadProgress = (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100))
  const create = useMutation({ mutationFn: (fd) => apiClient.post('/materials', fd, { onUploadProgress }), ...opts(videos ? 'Video added' : 'Material added') })
  const update = useMutation({ mutationFn: ({ id, body }) => apiClient.patch(`/materials/${id}`, body), ...opts('Saved') })
  const replace = useMutation({ mutationFn: ({ id, fd }) => apiClient.put(`/materials/${id}/replace-file`, fd, { onUploadProgress }), ...opts('File replaced') })
  const remove = useMutation({ mutationFn: (id) => apiClient.delete(`/materials/${id}`), ...opts('Removed') })

  const startAdd = () => { setFile(null); setEdit({ source: videos ? 'upload' : 'file', publication_state: 'published', display_order: rows.length + 1 }) }
  const save = () => {
    if (edit.id) {
      update.mutate({ id: edit.id, body: { title: edit.title, description: edit.description, display_order: Number(edit.display_order || 0), publication_state: edit.publication_state, resource_url: edit.resource_url } })
      if (file) { const fd = new FormData(); fd.append('file', file); replace.mutate({ id: edit.id, fd }) }
      return
    }
    const content_type = videos ? 'video' : edit.source === 'link' ? 'link' : 'file'
    const fd = new FormData()
    fd.append('title', edit.title); fd.append('program_id', program.id); fd.append('content_type', content_type)
    fd.append('publication_state', edit.publication_state); fd.append('display_order', edit.display_order || 0)
    if (edit.description) fd.append('description', edit.description)
    if (edit.source === 'link') fd.append('resource_url', edit.resource_url || '')
    else if (file) fd.append('file', file)
    create.mutate(fd)
  }
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })
  const needsFile = edit && !edit.id && edit.source !== 'link'
  const busy = create.isPending || update.isPending || replace.isPending

  if (!program || isLoading) return <Spinner />
  return (
    <div>
      <SectionTitle
        title={videos ? 'Videos' : 'Study Materials'}
        text={videos ? `Upload a video file (MP4, WebM, MOV — up to 300 MB) or paste a YouTube / Drive link. Only ${program.name} students see these.` : `PDF, Word, PowerPoint, Excel, ZIP or a web link. Only ${program.name} students see these.`}
        actions={<Button onClick={startAdd}><Plus size={16} /> {videos ? 'Add video' : 'Add material'}</Button>}
      />
      <Card>
        <Table
          rows={rows}
          emptyMessage={videos ? 'No videos yet.' : 'No study materials yet.'}
          columns={[
            { key: 'display_order', header: 'Order' },
            { key: 'title', header: 'Title' },
            { key: 'kind', header: 'Type', render: (r) => (r.file_path || r.file_type ? (r.file_type || 'file').toUpperCase() : r.content_type === 'video' ? 'Video link' : 'Link') },
            { key: 'publication_state', header: 'Visible to students', render: (r) => <Status value={r.publication_state === 'published' ? 'active' : 'draft'} label={r.publication_state === 'published' ? 'Published' : 'Hidden'} /> },
            { key: 'updated_at', header: 'Updated', render: (r) => fmtDate(r.updated_at || r.created_at) },
            {
              key: 'a', header: '', render: (r) => (
                <div className="flex flex-wrap gap-3 text-xs">
                  {r.resource_url
                    ? <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={r.resource_url} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a>
                    : <button className="text-brand-700 hover:underline" onClick={() => downloadFile(`/materials/${r.id}/download`, `${r.title}.${r.file_type}`)}>Download</button>}
                  <button className="text-slate-600 hover:underline" onClick={() => update.mutate({ id: r.id, body: { publication_state: r.publication_state === 'published' ? 'draft' : 'published' } })}>{r.publication_state === 'published' ? 'Hide' : 'Publish'}</button>
                  <button className="text-slate-600 hover:underline" onClick={() => { setFile(null); setEdit({ ...r, source: r.resource_url ? 'link' : 'upload' }) }}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => { if (window.confirm(`Remove “${r.title}”? Students will no longer see it.`)) remove.mutate(r.id) }}>Remove</button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!edit} onClose={() => !busy && setEdit(null)} wide title={edit?.id ? 'Edit' : videos ? 'Add video' : 'Add study material'}
        footer={<Button disabled={busy || !edit?.title || (needsFile && !file) || (edit?.source === 'link' && !edit?.resource_url)} onClick={save}>{progress != null ? `Uploading… ${progress}%` : 'Save'}</Button>}>
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Input label="Title" value={edit.title || ''} onChange={set('title')} /></div>
            {!edit.id && (
              <div className="flex gap-4 text-sm sm:col-span-2">
                <label className="flex items-center gap-2"><input type="radio" checked={edit.source !== 'link'} onChange={() => setEdit({ ...edit, source: videos ? 'upload' : 'file' })} /> {videos ? 'Upload video file' : 'Upload file'}</label>
                <label className="flex items-center gap-2"><input type="radio" checked={edit.source === 'link'} onChange={() => setEdit({ ...edit, source: 'link' })} /> {videos ? 'YouTube / Drive link' : 'Web link'}</label>
              </div>
            )}
            {edit.source === 'link'
              ? <div className="sm:col-span-2"><Input label="Link (https://…)" value={edit.resource_url || ''} onChange={set('resource_url')} /></div>
              : (
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700">{edit.id ? 'Replace file (optional)' : videos ? 'Video file' : 'File'}</span>
                  <input type="file" accept={videos ? '.mp4,.webm,.mov,.m4v' : '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.jpg,.jpeg,.png'} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {progress != null && <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-600" style={{ width: `${progress}%` }} /></div>}
                </label>
              )}
            <Input label="Display order" type="number" value={edit.display_order ?? 0} onChange={set('display_order')} />
            <Select label="Visible to students" value={edit.publication_state} onChange={set('publication_state')}><option value="published">Published</option><option value="draft">Hidden (draft)</option></Select>
            <div className="sm:col-span-2"><TextArea label="Description (optional)" value={edit.description || ''} onChange={set('description')} rows={3} /></div>
          </div>
        )}
      </Modal>
    </div>
  )
}


/* ================================================================== video curriculum: Module > Chapter > Video */
const ytVideoId = (url) => (url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/)?.[1]
function VideoModal({ video, programId, chapters, onClose, onSaved }) {
  const { push } = useToast()
  const [f, setF] = useState({ source: video.id && !video.resource_url ? 'upload' : 'link', publication_state: 'published', ...video, chapter_id: video.chapter_id ?? '' })
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const onUploadProgress = (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100))
  const save = async () => {
    setBusy(true)
    try {
      const duration = f.duration_minutes === '' || f.duration_minutes == null ? null : Number(f.duration_minutes)
      const chapter = f.chapter_id === '' ? null : Number(f.chapter_id)
      if (f.id) {
        await apiClient.patch(`/materials/${f.id}`, { title: f.title, description: f.description || null, display_order: Number(f.display_order || 0), publication_state: f.publication_state, resource_url: f.source === 'link' ? f.resource_url : undefined, chapter_id: chapter, duration_minutes: duration })
        if (file) { const fd = new FormData(); fd.append('file', file); await apiClient.put(`/materials/${f.id}/replace-file`, fd, { onUploadProgress }) }
      } else {
        const fd = new FormData()
        fd.append('title', f.title); fd.append('program_id', programId); fd.append('content_type', 'video')
        fd.append('publication_state', f.publication_state); fd.append('display_order', f.display_order || 0)
        if (chapter) fd.append('chapter_id', chapter)
        if (duration != null) fd.append('duration_minutes', duration)
        if (f.description) fd.append('description', f.description)
        if (f.source === 'link') fd.append('resource_url', f.resource_url || '')
        else fd.append('file', file)
        await apiClient.post('/materials', fd, { onUploadProgress })
      }
      push('Video saved', 'success')
      onSaved()
    } catch (e) {
      push(errorText(e), 'error')
    } finally {
      setBusy(false); setProgress(null)
    }
  }
  const yt = f.source === 'link' ? ytVideoId(f.resource_url) : null
  const linkBad = f.source === 'link' && !!(f.resource_url || '').trim() && !yt
  const valid = f.title && (f.source === 'link' ? !!yt : (f.id || file))
  return (
    <Modal open onClose={() => !busy && onClose()} wide title={f.id ? 'Edit video' : 'Add video'}
      footer={<Button disabled={busy || !valid} onClick={save}>{progress != null ? `Uploading… ${progress}%` : 'Save video'}</Button>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Video title" value={f.title || ''} onChange={set('title')} /></div>
        <Select label="Chapter" value={f.chapter_id} onChange={set('chapter_id')}>
          <option value="">— Not in a module —</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Input label="Duration (minutes)" type="number" value={f.duration_minutes ?? ''} onChange={set('duration_minutes')} />
        {f.source === 'link' ? (
          <div className="space-y-2 sm:col-span-2">
            <Input label="YouTube link (unlisted)" placeholder="https://youtu.be/… or https://www.youtube.com/watch?v=…" value={f.resource_url || ''} onChange={set('resource_url')} />
            {linkBad && <p className="text-xs text-red-600">That isn't a YouTube video link. Copy it from YouTube → Share.</p>}
            {yt ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" className="h-14 w-24 rounded object-cover" />
                <p className="text-xs text-emerald-800">Video found. Students watch it in the protected player — no YouTube title, links or recommendations.</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">On YouTube set the video's <b>Visibility → Unlisted</b> (not Private — private videos won't play here), then paste its link.</p>
            )}
          </div>
        ) : (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Replace video file (optional)</span>
            <input type="file" accept=".mp4,.webm,.mov,.m4v" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {progress != null && <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-600" style={{ width: `${progress}%` }} /></div>}
          </label>
        )}
        <Input label="Order inside the chapter" type="number" value={f.display_order ?? 0} onChange={set('display_order')} />
        <Select label="Visible to students" value={f.publication_state} onChange={set('publication_state')}><option value="published">Published</option><option value="draft">Hidden (draft)</option></Select>
        <div className="sm:col-span-2"><TextArea label="Description (optional)" rows={2} value={f.description || ''} onChange={set('description')} /></div>
      </div>
    </Modal>
  )
}

function NameModal({ title, label, initial, onClose, onSave, busy }) {
  const [v, setV] = useState(initial || { title: '' })
  return (
    <Modal open onClose={onClose} title={title} footer={<Button disabled={busy || !v.title?.trim()} onClick={() => onSave(v)}>Save</Button>}>
      <div className="space-y-3">
        <Input label={label} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus />
        <Input label="Order" type="number" value={v.display_order ?? ''} onChange={(e) => setV({ ...v, display_order: e.target.value })} />
      </div>
    </Modal>
  )
}

function VideoRow({ v, number, onEdit, onToggle, onDelete }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
      <PlayCircle size={16} className="shrink-0 text-sky-500" />
      <span className="w-10 shrink-0 text-sm text-slate-500">{number}</span>
      <span className="min-w-0 flex-1 text-sm text-slate-800">{v.title}{v.publication_state !== 'published' && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">Hidden</span>}</span>
      <span className="text-xs text-slate-400">{v.has_file ? (v.file_type || '').toUpperCase() : 'Link'}</span>
      <span className="w-16 text-right text-sm text-slate-600">{v.duration_minutes ? `${v.duration_minutes} mins` : '—'}</span>
      <div className="flex gap-3 text-xs">
        {v.resource_url
          ? <a className="text-brand-700 hover:underline" href={v.resource_url} target="_blank" rel="noreferrer">Open</a>
          : <button className="text-brand-700 hover:underline" onClick={() => downloadFile(`/materials/${v.id}/download`, `${v.title}.${v.file_type}`)}>Download</button>}
        <button className="text-slate-600 hover:underline" onClick={onToggle}>{v.publication_state === 'published' ? 'Hide' : 'Publish'}</button>
        <button className="text-slate-600 hover:underline" onClick={onEdit}>Edit</button>
        <button className="text-red-600 hover:underline" onClick={onDelete}>Remove</button>
      </div>
    </li>
  )
}

export function CurriculumSection({ tier }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const key = ['v2', 'curriculum', tier]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => apiClient.get(`/v2/staff/work/${tier}/curriculum`).then((r) => r.data) })
  const [open, setOpen] = useState({})
  const [video, setVideo] = useState(null)
  const [named, setNamed] = useState(null) // { kind: 'module'|'chapter', id?, moduleId?, initial }
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['materials'] }) }
  const run = useMutation({ mutationFn: ({ method, url, body }) => apiClient[method](url, body), onSuccess: () => { setNamed(null); refresh() }, onError: (e) => push(errorText(e), 'error') })

  if (isLoading || !data) return <Spinner />
  const chapters = data.modules.flatMap((m) => m.chapters.map((c) => ({ id: c.id, label: `Module ${m.number} › ${m.number}.${c.number} ${c.title}` })))
  const isOpen = (id) => open[id] ?? true
  const saveNamed = (v) => {
    const body = { title: v.title, display_order: v.display_order === '' || v.display_order == null ? null : Number(v.display_order) }
    const base = `/v2/staff/work/${tier}`
    if (named.kind === 'module') run.mutate(named.id ? { method: 'put', url: `${base}/modules/${named.id}`, body } : { method: 'post', url: `${base}/modules`, body })
    else run.mutate(named.id ? { method: 'put', url: `${base}/chapters/${named.id}`, body } : { method: 'post', url: `${base}/modules/${named.moduleId}/chapters`, body })
  }
  const rowActions = (v) => ({
    onEdit: () => setVideo(v),
    onToggle: () => apiClient.patch(`/materials/${v.id}`, { publication_state: v.publication_state === 'published' ? 'draft' : 'published' }).then(refresh).catch((e) => push(errorText(e), 'error')),
    onDelete: () => window.confirm(`Remove video “${v.title}”?`) && apiClient.delete(`/materials/${v.id}`).then(refresh).catch((e) => push(errorText(e), 'error')),
  })

  return (
    <div>
      <SectionTitle
        title="Videos"
        text="Organise videos as Module → Chapter → Video. Students see exactly this structure. Upload each video to YouTube as Unlisted and paste its link — it plays in a protected player with no YouTube links, recommendations or end screen."
        actions={<div className="flex gap-2"><Button variant="secondary" onClick={() => setVideo({ chapter_id: '' })}><Plus size={16} /> Add video</Button><Button onClick={() => setNamed({ kind: 'module' })}><Plus size={16} /> Add module</Button></div>}
      />
      {data.modules.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">No modules yet. Click <b>Add module</b> (for example “Module 1: Fundamentals of Programming”), then add chapters and videos inside it.</Card>}
      <div className="space-y-4">
        {data.modules.map((m) => (
          <Card key={m.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <button className="flex items-center gap-2 text-left" onClick={() => setOpen({ ...open, [m.id]: !isOpen(m.id) })}>
                {isOpen(m.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="text-base font-semibold text-sky-700">Module {m.number}: {m.title}</span>
              </button>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Chapters: {m.chapters.length}</span><span>Videos: {m.video_count}</span>{m.minutes > 0 && <span>{m.minutes} mins</span>}
                <button className="font-medium text-brand-700 hover:underline" onClick={() => setNamed({ kind: 'chapter', moduleId: m.id })}>+ Chapter</button>
                <button title="Rename" className="hover:text-brand-700" onClick={() => setNamed({ kind: 'module', id: m.id, initial: { title: m.title, display_order: m.display_order } })}><Pencil size={14} /></button>
                <button title="Delete module" className="hover:text-red-600" onClick={() => window.confirm(`Delete “${m.title}” and its chapters? Its videos are kept under “Not in a module”.`) && run.mutate({ method: 'delete', url: `/v2/staff/work/${tier}/modules/${m.id}` })}><Trash2 size={14} /></button>
              </div>
            </div>
            {isOpen(m.id) && (
              <div className="divide-y divide-slate-100">
                {m.chapters.length === 0 && <p className="px-4 py-4 text-sm text-slate-400">No chapters yet — click “+ Chapter”.</p>}
                {m.chapters.map((c) => (
                  <div key={c.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span className="flex items-center gap-3 font-medium text-slate-700"><span className="h-3.5 w-3.5 rounded-sm bg-sky-400" /> {m.number}.{c.number} {c.title}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <button className="font-medium text-brand-700 hover:underline" onClick={() => setVideo({ chapter_id: c.id, display_order: c.videos.length + 1 })}>+ Video</button>
                        <button title="Rename" className="hover:text-brand-700" onClick={() => setNamed({ kind: 'chapter', id: c.id, initial: { title: c.title, display_order: c.display_order } })}><Pencil size={14} /></button>
                        <button title="Delete chapter" className="hover:text-red-600" onClick={() => window.confirm(`Delete chapter “${c.title}”? Its videos are kept under “Not in a module”.`) && run.mutate({ method: 'delete', url: `/v2/staff/work/${tier}/chapters/${c.id}` })}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {c.videos.length > 0 && (
                      <ul className="pb-2 pl-6">{c.videos.map((v, i) => <VideoRow key={v.id} v={v} number={`${c.number}.${i + 1}`} {...rowActions(v)} />)}</ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      {data.unassigned.length > 0 && (
        <>
          <SectionTitle title="Not in a module" text="Students still see these, listed after the modules. Edit a video to move it into a chapter." />
          <Card><ul className="divide-y divide-slate-100">{data.unassigned.map((v, i) => <VideoRow key={v.id} v={v} number={`${i + 1}`} {...rowActions(v)} />)}</ul></Card>
        </>
      )}
      {video && <VideoModal video={video} programId={data.program_id} chapters={chapters} onClose={() => setVideo(null)} onSaved={() => { setVideo(null); refresh() }} />}
      {named && <NameModal title={`${named.id ? 'Edit' : 'Add'} ${named.kind}`} label={named.kind === 'module' ? 'Module name (e.g. Fundamentals of Programming)' : 'Chapter name (e.g. Python for Data Science Introduction)'} initial={named.initial} busy={run.isPending} onClose={() => setNamed(null)} onSave={saveNamed} />}
    </div>
  )
}
