import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, Download, FileArchive, FileText, GitBranch, Globe, Info, Lock, MessageSquare, Send, UploadCloud, X } from 'lucide-react'
import apiClient from '../../api/client'
import FeedbackChat from '../../components/v2/FeedbackChat'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { Pill, downloadFile, errorText, fmtDate, fmtDateTime } from '../../lib/v2'

const SLOTS = { real_world_project: [3, 'Real-World Project'], internship_task: [3, 'Internship Task'] }

const TITLES = {
  accelerator_assignment: ['22 Technical Assignments', 'Assignments are provided by ARINSA AI MINDS. Submit each one below.'],
  real_world_project: ['3 Real-World Projects', 'ARINSA AI MINDS assigns your 3 projects to you individually. Each one appears here with its brief and due date; submit your work on the project card.'],
  internship_task: ['Internship Tasks', 'Tasks, live projects and office work assigned by ARINSA AI MINDS during your internship.'],
}

const MAX_MB = 50
const isUrl = (v) => /^https?:\/\/\S+\.\S+/i.test(v.trim())
const isGithub = (v) => /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/i.test(v.trim())
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function Step({ n, title, hint, children }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
        {children}
      </div>
    </div>
  )
}

function SubmitForm({ item, onDone }) {
  const { push } = useToast()
  const [f, setF] = useState({ repo_link: '', demo_url: '', notes: '' })
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [progress, setProgress] = useState(0)
  const pickFile = (fl) => {
    if (!fl) return
    if (fl.size > MAX_MB * 1048576) { push(`File is too large (max ${MAX_MB} MB).`, 'error'); return }
    setFile(fl)
  }
  const repoErr = f.repo_link.trim() && !isGithub(f.repo_link) ? 'Enter a full GitHub repository link, e.g. https://github.com/you/project' : ''
  const demoErr = f.demo_url.trim() && !isUrl(f.demo_url) ? 'Enter a full link starting with https://' : ''
  const hasWork = !!file || (f.repo_link.trim() && !repoErr)
  const ready = hasWork && !repoErr && !demoErr
  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('project_id', item.project_id)
      Object.entries(f).forEach(([k, v]) => v.trim() && fd.append(k, v.trim()))
      if (file) fd.append('file', file)
      setProgress(0)
      return apiClient.post('/v2/me/work/submit', fd, { onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)) })
    },
    onSuccess: (r) => { push(`Submitted successfully (version ${r.data.version}).`, 'success'); onDone() },
    onError: (e) => { push(errorText(e), 'error'); setReviewing(false) },
  })
  const resubmit = item.status === 'revision_requested'
  return (
    <section className="mt-2 overflow-hidden rounded-2xl border border-brand-100 bg-white">
      <div className="flex items-center gap-2 bg-brand-50 px-5 py-3">
        <UploadCloud size={18} className="text-brand-700" />
        <p className="font-semibold text-slate-900">{resubmit ? 'Resubmit your work' : 'Submit your work'}</p>
      </div>
      {!reviewing ? (
        <div className="space-y-5 p-5">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Provide <b>at least one</b>: a project file (ZIP) <b>or</b> a GitHub repository link. Adding both is best.</span>
          </div>
          <Step n={1} title="Upload your project file" hint={`ZIP your source code (exclude node_modules / venv). Max ${MAX_MB} MB.`}>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <FileArchive size={22} className="shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{fmtSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-red-600"><X size={16} /></button>
              </div>
            ) : (
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]) }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}>
                <UploadCloud size={28} className="text-brand-600" />
                <span className="text-sm font-medium text-slate-800">Drag & drop your file here, or <span className="text-brand-700 underline">browse</span></span>
                <span className="text-xs text-slate-500">.zip recommended</span>
                <input type="file" className="sr-only" data-testid="work-file" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
              </label>
            )}
          </Step>
          <Step n={2} title="GitHub repository link" hint="Make sure the repository is public, or shared with ARINSA AI MINDS.">
            <div className="relative">
              <GitBranch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={f.repo_link} onChange={(e) => setF({ ...f, repo_link: e.target.value })} placeholder="https://github.com/your-name/your-project"
                className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm ${repoErr ? 'border-red-400' : 'border-slate-300'}`} />
            </div>
            {repoErr && <p className="mt-1 text-xs text-red-600">{repoErr}</p>}
          </Step>
          <Step n={3} title="Live / demo link" hint="Optional — a deployed app or a demo video.">
            <div className="relative">
              <Globe size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={f.demo_url} onChange={(e) => setF({ ...f, demo_url: e.target.value })} placeholder="https://…"
                className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm ${demoErr ? 'border-red-400' : 'border-slate-300'}`} />
            </div>
            {demoErr && <p className="mt-1 text-xs text-red-600">{demoErr}</p>}
          </Step>
          <Step n={4} title="Notes for the reviewer" hint="Optional — setup steps, login details, or anything the reviewer should know.">
            <textarea rows={3} maxLength={2000} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Run `pip install -r requirements.txt` then `uvicorn main:app`" />
          </Step>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className={`text-xs ${ready ? 'text-emerald-700' : 'text-slate-500'}`}>{ready ? '✓ Ready to submit' : 'Add a file or a valid GitHub link to continue.'}</p>
            <Button disabled={!ready} onClick={() => setReviewing(true)}>Review & submit <ArrowRight size={15} /></Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <p className="text-sm font-semibold text-slate-800">Please check before submitting</p>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {[['Project', item.title], ['File', file ? `${file.name} (${fmtSize(file.size)})` : '—'], ['GitHub', f.repo_link.trim() || '—'], ['Demo', f.demo_url.trim() || '—'], ['Notes', f.notes.trim() || '—']].map(([k, v]) => (
              <div key={k} className="flex gap-3 px-4 py-2"><dt className="w-20 shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 break-words text-slate-900">{v}</dd></div>
            ))}
          </dl>
          <p className="flex items-start gap-2 text-xs text-amber-700"><Info size={14} className="mt-0.5 shrink-0" /> After submitting you can't edit it — you can resubmit only if the reviewer asks for a revision.</p>
          {submit.isPending && file && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" disabled={submit.isPending} onClick={() => setReviewing(false)}>Edit</Button>
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}><Send size={15} /> {submit.isPending ? (file ? `Uploading… ${progress}%` : 'Submitting…') : 'Confirm & submit'}</Button>
          </div>
        </div>
      )}
    </section>
  )
}

const STAGES = [['submitted', 'Submitted'], ['under_review', 'Under review'], ['graded', 'Completed']]
const daysLeft = (d) => (d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null)

function StatusTrack({ status, hasSubs }) {
  const idx = !hasSubs ? -1 : status === 'graded' ? 2 : status === 'under_review' || status === 'revision_requested' ? 1 : 0
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STAGES.map(([k, label], i) => {
        const revision = status === 'revision_requested' && i === 1
        const done = i < idx || (i === idx && !revision)
        return (
          <li key={k} className="flex flex-1 items-center gap-2">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${revision ? 'bg-red-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white/70 ring-1 ring-white/30'}`}>
              {revision ? '!' : done ? <CheckCircle2 size={14} /> : i + 1}
            </span>
            <span className={`whitespace-nowrap font-medium ${revision ? 'text-red-200' : done ? 'text-white' : 'text-white/60'}`}>{revision ? 'Revision required' : label}</span>
            {i < STAGES.length - 1 && <span className={`h-px flex-1 ${i < idx ? 'bg-emerald-400' : 'bg-white/20'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

export function WorkItem({ item, onChanged, defaultOpen, briefElsewhere }) {
  const [open, setOpen] = useState(defaultOpen || item.can_submit || item.status === 'revision_requested')
  const latest = item.submissions[0]
  if (item.status === 'graded') {
    return (
      <article className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
        <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.label}</p>
          <h2 className="truncate font-semibold text-slate-900">{item.title}</h2>
        </div>
        {latest?.grade != null && <span className="text-sm font-medium text-emerald-800">Grade {latest.grade}</span>}
        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Completed</span>
      </article>
    )
  }
  const left = daysLeft(item.deadline)
  const chatOpen = ['submitted', 'under_review'].includes(item.status)
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="bg-gradient-to-br from-[#0B2E59] to-[#1254A6] px-6 py-5 text-white">
        <button onClick={() => setOpen(!open)} style={{ boxShadow: 'none', transform: 'none', background: 'transparent' }} className="flex w-full items-start justify-between gap-4 p-0 text-left text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">{item.label}</p>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{item.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {item.assigned_at && <span className="rounded-full bg-white/10 px-2.5 py-1">Assigned {fmtDate(item.assigned_at)}</span>}
              {item.deadline && <span className={`rounded-full px-2.5 py-1 ${left != null && left <= 3 ? 'bg-red-500/90' : 'bg-white/10'}`}>Due {fmtDate(item.deadline)}{left != null && left >= 0 && <> · {left === 0 ? 'today' : `${left} day${left === 1 ? '' : 's'} left`}</>}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {item.unread_messages > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold"><MessageSquare size={12} /> {item.unread_messages} new</span>}
            {item.locked ? <span className="inline-flex items-center gap-1 text-xs text-white/80"><Lock size={13} /> Opens {fmtDate(item.available_on)}</span> : <Pill value={item.status} label={item.status_label} />}
            <ChevronDown size={20} className={`text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {!item.locked && <div className="mt-4 border-t border-white/10 pt-4"><StatusTrack status={item.status} hasSubs={item.submissions.length > 0} /></div>}
      </header>

      {open && !item.locked && (
        <div className="grid gap-6 bg-slate-50/60 p-5 text-sm lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-4">
            {briefElsewhere ? (
              <Link to="/project-selection" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 hover:border-brand-300">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileText size={18} /></span>
                <span className="flex-1"><b className="block text-slate-900">Project brief</b><span className="text-xs text-slate-500">Re-read the requirements in Project Selection</span></span>
                <ArrowRight size={16} className="text-brand-700" />
              </Link>
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                {item.technology && <p><b>Technology:</b> {item.technology}</p>}
                {item.description && <p className="whitespace-pre-wrap text-slate-700">{item.description}</p>}
                {item.instructions && <p className="whitespace-pre-wrap text-slate-600"><b>Instructions:</b> {item.instructions}</p>}
                {item.has_resource_file && <button onClick={() => downloadFile(`/v2/me/work/${item.project_id}/resource`)} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Download size={14} /> {item.resource_file_name || 'Resource file'}</button>}
              </div>
            )}

            {latest?.feedback && (
              <div className={`flex gap-3 rounded-xl border p-4 ${item.status === 'revision_requested' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                <Info size={18} className="mt-0.5 shrink-0" />
                <div><b className="block">Reviewer feedback</b>{latest.feedback}{latest.grade != null && <> · Grade {latest.grade}</>}</div>
              </div>
            )}

            {item.submissions.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Submission history</p>
                <ul className="divide-y divide-slate-100">
                  {item.submissions.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">v{s.version}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500">{fmtDateTime(s.submitted_at)}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {s.has_file && <button onClick={() => downloadFile(`/v2/me/work/submissions/${s.id}/download`)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:border-brand-300"><FileArchive size={12} /> File</button>}
                          {s.repo_link && <a href={s.repo_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:border-brand-300"><GitBranch size={12} /> GitHub</a>}
                          {s.demo_url && <a href={s.demo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:border-brand-300"><Globe size={12} /> Demo</a>}
                        </div>
                      </div>
                      <Pill value={s.status} label={s.status_label} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {item.can_submit && <SubmitForm item={item} onDone={onChanged} />}
            {!item.can_submit && chatOpen && (
              <p className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800"><Info size={16} /> Your work is with the reviewer. You'll be notified when it's reviewed.</p>
            )}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <FeedbackChat me="student" queryKey={['v2', 'feedback', 'me', item.project_id]}
              listUrl={`/v2/me/work/${item.project_id}/messages`} postUrl={`/v2/me/work/${item.project_id}/messages`}
              title="Reviewer chat" height="h-[420px]"
              disabled={!chatOpen}
              disabledText={item.submissions.length === 0
                ? 'Chat opens after you submit your project.'
                : item.status === 'revision_requested'
                  ? 'Resubmit your project to chat with your reviewer again.'
                  : 'Chat is closed for this project.'}
              emptyText="No messages yet. Ask your reviewer anything about your submission." />
          </aside>
        </div>
      )}
    </article>
  )
}



export const TAB_DOT = { graded: 'bg-emerald-500', submitted: 'bg-sky-500', under_review: 'bg-amber-500', revision_requested: 'bg-red-500' }

function ProjectTabs({ items, onChanged }) {
  const [active, setActive] = useState(() => {
    const i = items.findIndex((it) => it.status === 'revision_requested' || it.unread_messages > 0)
    return i >= 0 ? i : 0
  })
  const item = items[active] || items[0]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2" role="tablist">
        {items.map((it, i) => {
          const on = i === active
          return (
            <button key={it.project_id} role="tab" aria-selected={on} onClick={() => setActive(i)}
              style={{ transform: 'none' }}
              className={`relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${on ? 'border-brand-600 bg-white shadow-md' : 'border-slate-200 bg-white/70 hover:border-brand-300 hover:bg-white'}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{it.label || `Project ${i + 1}`}</span>
                <span className="block truncate font-semibold text-slate-900">{it.title}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${TAB_DOT[it.status] || 'bg-slate-300'}`} />{it.status_label}
                </span>
              </span>
              {it.unread_messages > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">{it.unread_messages} new</span>}
            </button>
          )
        })}
      </div>
      <WorkItem key={item.project_id} item={item} onChanged={onChanged} defaultOpen briefElsewhere />
    </div>
  )
}

export default function Work() {
  const [params] = useSearchParams()
  const kind = params.get('kind')
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['v2', 'work', kind], queryFn: () => apiClient.get('/v2/me/work', { params: { kind: kind || undefined } }).then((r) => r.data) })
  if (isLoading) return <Spinner />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorText(error)}</p>
  const tier = data.tier
  const [title, subtitle] = TITLES[kind] || (tier === 'basic' || tier === 'professional'
    ? ['Project Submission', tier === 'basic' ? 'Submit your selected project.' : 'Submit both of your selected projects. Each has its own status and review.']
    : ['Assigned Tasks & Projects', 'Work assigned by ARINSA AI MINDS based on your internship form, resume and area of interest.'])
  const empty = tier === 'basic' || tier === 'professional'
    ? <>No project selected yet. <Link to="/project-selection" className="text-brand-700 underline">Select your project</Link> first.</>
    : kind === 'internship_task' || tier === 'advanced' || tier === 'career'
      ? <>No work has been assigned yet. Make sure your <Link to="/internship-form" className="text-brand-700 underline">Internship Form</Link> is submitted — ARINSA AI MINDS will assign work after reviewing it.</>
      : kind === 'real_world_project' ? 'Your projects have not been assigned yet. ARINSA AI MINDS will assign each of your 3 projects to you — you will get a notification.'
      : 'Nothing published yet.'
  const refresh = () => qc.invalidateQueries({ queryKey: ['v2'] })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {data.access === 'expired' && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Your access period has ended, so submissions are closed. Contact Support to request an extension.</p>}
      {SLOTS[kind] ? (() => {
        const [n, noun] = SLOTS[kind]
        const byNum = {}
        data.items.forEach((it, i) => { const m = /(\d+)\s*$/.exec(it.label || ''); byNum[m ? Number(m[1]) : i + 1] = it })
        const done = data.items.filter((it) => it.status === 'graded').length
        return (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-700">{done} of {n} {noun}s completed</span><span className="text-slate-500">{data.items.length} of {n} assigned</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / n) * 100}%` }} /></div>
            </div>
            {Array.from({ length: n }, (_, i) => byNum[i + 1]
              ? <WorkItem key={byNum[i + 1].project_id} item={byNum[i + 1]} onChanged={refresh} defaultOpen={!byNum[i + 1].locked} briefElsewhere={false} />
              : (
                <article key={`slot-${i}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-4">
                  <Lock size={18} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{noun} {i + 1}</p>
                    <p className="text-sm text-slate-500">Not assigned yet — ARINSA AI MINDS will assign it and you'll get a notification.</p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Waiting</span>
                </article>
              ))}
          </>
        )
      })() : data.items.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{empty}</p>
        : tier === 'professional' && data.items.length > 1 ? <ProjectTabs items={data.items} onChanged={refresh} />
        : data.items.map((item) => <WorkItem key={item.project_id} item={item} onChanged={refresh} defaultOpen={data.items.length <= 3 && !item.locked} briefElsewhere={tier === 'basic' || tier === 'professional'} />)}
    </div>
  )
}
