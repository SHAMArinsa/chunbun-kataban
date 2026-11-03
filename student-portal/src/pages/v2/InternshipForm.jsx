import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Download, Upload } from 'lucide-react'
import apiClient from '../../api/client'
import DetailedInternshipForm from './DetailedInternshipForm'
import { TAB_DOT, WorkItem } from './Work'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { Pill, downloadFile, errorText, fmtDate, fmtDateTime } from '../../lib/v2'

const Area = ({ label, ...p }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-700">{label}</span>
    <textarea rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50" {...p} />
  </label>
)


const TASK_COUNT = 3

function AcceleratorInternship({ data, part = 'all' }) {
  const qcTasks = useQueryClient()
  const [activeTask, setActiveTask] = useState(null)
  const { data: work } = useQuery({ queryKey: ['v2', 'work', 'internship_task'], queryFn: () => apiClient.get('/v2/me/work', { params: { kind: 'internship_task' } }).then((r) => r.data) })
  const tasks = work?.items || []
  const submitted = ['submitted', 'completed'].includes(data.status)
  const done = tasks.filter((t) => t.status === 'graded').length
  const from = data.fill_from ? new Date(data.fill_from) : null
  const by = data.fill_by ? new Date(data.fill_by) : null
  const now = new Date()
  const learning = from && now < from
  const daysTo = (d) => Math.max(0, Math.ceil((d - now) / 86400000))
  const steps = [
    { title: 'Learning phase', text: '5 months 20 days of course work', state: learning && !submitted ? 'current' : 'done' },
    { title: 'Internship Form & Resume', text: submitted ? 'Submitted' : from ? `Recommended after ${fmtDate(data.fill_from)} · submit by ${fmtDate(data.fill_by)} · early start allowed` : 'Fill it below', state: submitted ? 'done' : 'current' },
    { title: `${TASK_COUNT} Internship Tasks`, text: `${done} of ${TASK_COUNT} completed`, state: done >= TASK_COUNT ? 'done' : submitted ? 'current' : 'todo' },
  ]
  return (
    <div className="space-y-5">
      {part !== 'tasks' && <>
      {/* Progress path */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((st, i) => (
            <li key={st.title} className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${st.state === 'done' ? 'bg-emerald-100 text-emerald-700' : st.state === 'current' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {st.state === 'done' ? <CheckCircle2 size={18} /> : i + 1}
              </span>
              <div>
                <p className={`font-semibold ${st.state === 'todo' ? 'text-slate-400' : 'text-slate-900'}`}>{st.title}</p>
                <p className="text-xs text-slate-500">{st.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {from && !submitted && (
        <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white p-6">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-600 text-white">
            <span className="text-2xl font-bold leading-none">{learning ? daysTo(from) : daysTo(by)}</span><span className="text-[10px] uppercase">days</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-lg font-semibold text-slate-900"><CalendarClock size={20} className="text-brand-600" />
              Fill your Internship Form after {fmtDate(data.fill_from)} and submit it before {fmtDate(data.fill_by)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {learning
                ? <>Your internship stage normally starts after 5 months and 20 days of learning ({daysTo(from)} days to go). <b>Progressing faster?</b> You can fill and submit the form below now and start your internship work early.</>
                : now > by ? <>The submission date has passed — please submit your form as soon as possible.</>
                : <>{daysTo(by)} days left to submit your form and resume.</>}
            </p>
          </div>
        </section>
      )}

      </>}

      {part !== 'top' && (
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Internship Tasks</h2>
            <p className="text-sm text-slate-500">ARINSA AI MINDS assigns {TASK_COUNT} tasks based on your form and resume.</p>
          </div>
        </div>
        {(() => {
          const first = tasks.findIndex((t) => t.status === 'revision_requested' || t.unread_messages > 0)
          const idx = activeTask ?? (first >= 0 ? first : 0)
          const t = tasks[idx]
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3" role="tablist">
                {Array.from({ length: TASK_COUNT }, (_, i) => {
                  const it = tasks[i]
                  const on = i === idx
                  return (
                    <button key={i} type="button" role="tab" aria-selected={on} onClick={() => setActiveTask(i)} style={{ transform: 'none' }}
                      className={`relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${on ? 'border-brand-600 bg-white shadow-md' : 'border-slate-200 bg-white/70 hover:border-brand-300 hover:bg-white'}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Internship Task {i + 1}</span>
                        <span className={`block truncate font-semibold ${it ? 'text-slate-900' : 'text-slate-400'}`}>{it ? it.title : 'Not assigned yet'}</span>
                        <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${it ? TAB_DOT[it.status] || 'bg-slate-300' : 'bg-slate-200'}`} />{it ? it.status_label : 'Waiting'}
                        </span>
                      </span>
                      {it?.unread_messages > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">{it.unread_messages} new</span>}
                    </button>
                  )
                })}
              </div>
              {t ? (
                <WorkItem key={t.project_id} item={t} defaultOpen briefElsewhere={false}
                  onChanged={() => qcTasks.invalidateQueries({ queryKey: ['v2'] })} />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
                  <p className="font-semibold text-slate-700">Internship Task {idx + 1} is not assigned yet</p>
                  <p className="mt-1 text-sm text-slate-500">{submitted ? 'ARINSA AI MINDS will assign it soon — you will get a notification.' : 'It will be assigned after you submit your Internship Form & Resume above.'}</p>
                </div>
              )}
            </div>
          )
        })()}
      </section>
      )}
    </div>
  )
}

export default function InternshipForm() {
  const qc = useQueryClient()
  const { push } = useToast()
  const { data, isLoading, error } = useQuery({ queryKey: ['v2', 'form'], queryFn: () => apiClient.get('/v2/me/internship-form').then((r) => r.data) })
  const { data: areas } = useQuery({ queryKey: ['v2', 'areas'], enabled: !!data && !data.locked, queryFn: () => apiClient.get('/v2/me/areas-of-interest').then((r) => r.data) })
  const [f, setF] = useState(null)
  useEffect(() => {
    if (data && !f) setF({ phone: data.phone || '', education: data.education || '', institution: data.institution || '', area_of_interest_id: data.area_of_interest_id || '', skills: data.skills || '', experience: data.experience || '', preferred_role: data.preferred_role || '', comments: data.comments || '' })
  }, [data, f])
  const refresh = () => qc.invalidateQueries({ queryKey: ['v2'] })
  const save = useMutation({ mutationFn: () => apiClient.put('/v2/me/internship-form', { ...f, area_of_interest_id: f.area_of_interest_id ? Number(f.area_of_interest_id) : null }), onSuccess: () => { push('Draft saved', 'success'); refresh() }, onError: (e) => push(errorText(e), 'error') })
  const upload = useMutation({ mutationFn: (file) => { const fd = new FormData(); fd.append('file', file); return apiClient.post('/v2/me/internship-form/resume', fd) }, onSuccess: () => { push('Resume uploaded', 'success'); refresh() }, onError: (e) => push(errorText(e), 'error') })
  const submit = useMutation({
    mutationFn: async () => { await apiClient.put('/v2/me/internship-form', { ...f, area_of_interest_id: f.area_of_interest_id ? Number(f.area_of_interest_id) : null }); return apiClient.post('/v2/me/internship-form/submit') },
    onSuccess: () => { push('Internship form submitted to ARINSA AI MINDS', 'success'); refresh() },
    onError: (e) => push(errorText(e), 'error'),
  })

  if (isLoading) return <Spinner />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorText(error)}</p>
  const accelerator = data.tier === 'accelerator'

  if (data.locked && accelerator) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Internship</h1>
          <p className="text-sm text-slate-500">Your Career Accelerator internship stage: submit the Internship Form & Resume, then complete 3 internship tasks assigned by ARINSA AI MINDS.</p>
        </div>
        <AcceleratorInternship data={data} />
      </div>
    )
  }
  if (data.locked) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <CalendarClock size={36} className="mx-auto mb-3 text-brand-600" />
        <h1 className="text-lg font-semibold text-slate-900">Internship Form opens on {fmtDate(data.available_on)}</h1>
      </div>
    )
  }
  if (!f) return <Spinner />
  const editable = data.editable
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <div className={`mx-auto space-y-5 ${data.schema || accelerator ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{accelerator ? 'Internship' : 'Internship Information Form'}</h1>
          <p className="text-sm text-slate-500">Complete the form and upload your resume. ARINSA AI MINDS will review it and assign your {accelerator ? 'internship tasks, live projects or office work' : 'tasks and projects'}.</p>
        </div>
        <Pill value={data.status === 'submitted' || data.status === 'completed' ? 'completed' : data.status === 'revision_required' ? 'revision_requested' : 'in_progress'} label={data.status === 'not_started' ? 'Not started' : data.status.replace('_', ' ')} />
      </div>

      {accelerator && <AcceleratorInternship data={data} part="top" />}
      {data.status === 'revision_required' && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">ARINSA AI MINDS asked you to update your form. Please make the changes and submit again.</p>}
      {!editable && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div>Submitted on {fmtDateTime(data.submitted_at)}. {accelerator
            ? <>Your assigned internship work will appear in <Link className="underline" to="/work?kind=internship_task">Internship Tasks</Link>.</>
            : <>
              <p className="mt-1">Our team will call or email you within <b>7 working days</b> for a discussion, so please stay available. Until then, keep studying our <Link className="underline" to="/materials">Study Materials</Link> and any other resources you have or follow.</p>
              <p className="mt-1">Your assigned work will appear in <Link className="font-semibold underline" to="/work">Assigned Tasks / Projects</Link>, so please check it daily.</p>
            </>}</div>
        </div>
      )}

      {data.schema && <DetailedInternshipForm data={data} />}
      {!data.schema && (<>
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <Input label="Student name" value={data.student_name} disabled />
        <Input label="Student ID" value={data.student_number} disabled />
        <Input label="Email address" value={data.email} disabled />
        <Input label="Phone number" value={f.phone} onChange={set('phone')} disabled={!editable} />
        <Input label="Current education / qualification" value={f.education} onChange={set('education')} disabled={!editable} />
        <Input label="College / University" value={f.institution} onChange={set('institution')} disabled={!editable} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Area of interest</span>
          <select value={f.area_of_interest_id} onChange={set('area_of_interest_id')} disabled={!editable} className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50">
            <option value="">— Select —</option>
            {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        {data.show_preferred_role && <Input label={accelerator ? 'Preferred internship area' : 'Preferred job role / career interest'} value={f.preferred_role} onChange={set('preferred_role')} disabled={!editable} />}
        <div className="sm:col-span-2"><Area label="Relevant skills / technologies" value={f.skills} onChange={set('skills')} disabled={!editable} /></div>
        <div className="sm:col-span-2"><Area label="Previous experience (if applicable)" value={f.experience} onChange={set('experience')} disabled={!editable} /></div>
        <div className="sm:col-span-2"><Area label="Additional information / comments" value={f.comments} onChange={set('comments')} disabled={!editable} /></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-800">Resume</p>
        {data.resumes.length ? (
          <ul className="mb-3 space-y-1 text-sm">
            {data.resumes.map((r) => (
              <li key={r.id}><button onClick={() => downloadFile(`/v2/me/internship-form/resume/${r.id}`, r.file_name)} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Download size={13} /> v{r.version} · {r.file_name}</button> <span className="text-xs text-slate-400">{fmtDateTime(r.uploaded_at)}</span></li>
            ))}
          </ul>
        ) : <p className="mb-3 text-sm text-slate-500">No resume uploaded yet.</p>}
        {editable && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-brand-400">
            <Upload size={15} /> {upload.isPending ? 'Uploading…' : data.resumes.length ? 'Upload a new version (PDF/DOCX)' : 'Upload resume (PDF/DOCX)'}
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          </label>
        )}
      </section>

      {editable && (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>Save draft</Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>Submit form</Button>
        </div>
      )}
      </>)}
      {accelerator && <AcceleratorInternship data={data} part="tasks" />}
    </div>
  )
}
