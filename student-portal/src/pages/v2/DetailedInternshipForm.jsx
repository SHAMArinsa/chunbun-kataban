import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Briefcase, CheckCircle2, Cpu, Download, FileText, GraduationCap, Lightbulb, Plus, Save, Send, SlidersHorizontal, Upload, X,
} from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { downloadFile, errorText, fmtDateTime } from '../../lib/v2'

const ICONS = { academic: GraduationCap, technical: Cpu, experience: Briefcase, preferences: SlidersHorizontal, career: Lightbulb, resume: FileText }
const visible = (f, d) => !f.show_if || Object.entries(f.show_if).every(([k, allowed]) => allowed.includes(d[k]))
const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const missingIn = (fields, d) => fields.filter((f) => f.required && visible(f, d) && empty(d[f.key]))

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500'

function Choice({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" disabled={disabled} onClick={() => onChange(value === o ? '' : o)}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${value === o ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'} disabled:cursor-not-allowed disabled:opacity-70`}>
          {o}
        </button>
      ))}
    </div>
  )
}

function Tags({ value = [], onChange, suggestions = [], disabled, placeholder = 'Type and press Enter' }) {
  const [t, setT] = useState('')
  const add = (x) => { const v = x.trim(); if (v && !value.some((y) => y.toLowerCase() === v.toLowerCase())) onChange([...value, v]); setT('') }
  const rest = suggestions.filter((s) => !value.some((y) => y.toLowerCase() === s.toLowerCase()))
  return (
    <div>
      <div className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 ${disabled ? 'bg-slate-50' : ''}`}>
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">
            {v}{!disabled && <button type="button" onClick={() => onChange(value.filter((y) => y !== v))} aria-label={`Remove ${v}`}><X size={12} /></button>}
          </span>
        ))}
        {!disabled && (
          <input value={t} onChange={(e) => setT(e.target.value)} placeholder={value.length ? '' : placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(t) } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)) }}
            onBlur={() => t && add(t)} className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm focus:outline-none" />
        )}
      </div>
      {!disabled && rest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rest.map((s) => <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"><Plus size={11} />{s}</button>)}
        </div>
      )}
    </div>
  )
}

function Leveled({ value = [], onChange, suggestions = [], levels, disabled }) {
  const [t, setT] = useState('')
  const add = (name) => { const v = name.trim(); if (v && !value.some((x) => x.name.toLowerCase() === v.toLowerCase())) onChange([...value, { name: v, level: levels[0] }]); setT('') }
  const rest = suggestions.filter((s) => !value.some((x) => x.name.toLowerCase() === s.toLowerCase()))
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {value.map((it, i) => (
            <li key={it.name} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="min-w-[110px] flex-1 text-sm font-medium text-slate-800">{it.name}</span>
              <div className="flex gap-1">
                {levels.map((l) => (
                  <button key={l} type="button" disabled={disabled} onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, level: l } : x)))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${it.level === l ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
                ))}
              </div>
              {!disabled && <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${it.name}`}><X size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <>
          <div className="flex gap-2">
            <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(t) } }} placeholder="Add another…" className={inputCls} />
            <Button type="button" variant="secondary" onClick={() => add(t)} disabled={!t.trim()}><Plus size={15} /> Add</Button>
          </div>
          {rest.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {rest.map((s) => <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"><Plus size={11} />{s}</button>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Field({ f, d, set, disabled, showErrors }) {
  const v = d[f.key]
  const err = showErrors && f.required && empty(v)
  const onChange = (x) => set(f.key, x)
  let control
  if (f.type === 'text' || f.type === 'year') control = <input type={f.type === 'year' ? 'number' : 'text'} value={v ?? ''} placeholder={f.placeholder || (f.type === 'year' ? 'e.g. 2027' : '')} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${inputCls} ${err ? 'border-red-400' : ''}`} />
  else if (f.type === 'textarea') control = <textarea rows={3} value={v ?? ''} placeholder={f.placeholder || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${inputCls} ${err ? 'border-red-400' : ''}`} />
  else if (f.type === 'select') control = (
    <select value={v ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${inputCls} ${err ? 'border-red-400' : ''}`}>
      <option value="">— Select —</option>{f.options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
  else if (f.type === 'choice') control = <Choice options={f.options} value={v} onChange={onChange} disabled={disabled} />
  else if (f.type === 'tags') control = <Tags value={v || []} onChange={onChange} suggestions={f.suggestions} disabled={disabled} />
  else if (f.type === 'leveled') control = <Leveled value={v || []} onChange={onChange} suggestions={f.suggestions} levels={f.levels} disabled={disabled} />
  const wide = ['textarea', 'tags', 'leveled', 'choice'].includes(f.type)
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{f.label}{f.required ? <span className="text-red-500"> *</span> : <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}</p>
      {control}
      {err && <p className="mt-1 text-xs text-red-600">This field is required.</p>}
    </div>
  )
}

export default function DetailedInternshipForm({ data }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const [d, setD] = useState(() => ({ ...(data.details || {}) }))
  const [step, setStep] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const editable = data.editable
  const steps = useMemo(() => [...data.schema, { key: 'resume', title: 'Resume', fields: [] }], [data.schema])
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  const refresh = () => qc.invalidateQueries({ queryKey: ['v2'] })
  const payload = () => ({ details: { ...d, graduation_year: d.graduation_year ? Number(d.graduation_year) : undefined } })

  const save = useMutation({ mutationFn: () => apiClient.put('/v2/me/internship-form', payload()), onSuccess: () => refresh(), onError: (e) => push(errorText(e), 'error') })
  const upload = useMutation({ mutationFn: (file) => { const fd = new FormData(); fd.append('file', file); return apiClient.post('/v2/me/internship-form/resume', fd) }, onSuccess: () => { push('Resume uploaded', 'success'); refresh() }, onError: (e) => push(errorText(e), 'error') })
  const submit = useMutation({
    mutationFn: async () => { await apiClient.put('/v2/me/internship-form', payload()); return apiClient.post('/v2/me/internship-form/submit') },
    onSuccess: () => { push('Internship form submitted to ARINSA AI MINDS', 'success'); refresh() },
    onError: (e) => push(errorText(e), 'error'),
  })

  const stepMissing = steps.map((s) => (s.key === 'resume' ? (data.resumes.length ? [] : [{ label: 'Resume' }]) : missingIn(s.fields, d)))
  const totalRequired = data.schema.reduce((n, s) => n + s.fields.filter((f) => f.required && visible(f, d)).length, 0) + 1
  const totalMissing = stepMissing.reduce((n, m) => n + m.length, 0)
  const pct = Math.round(((totalRequired - totalMissing) / totalRequired) * 100)
  const cur = steps[step]
  const last = step === steps.length - 1

  const go = async (n) => {
    if (editable) { try { await save.mutateAsync() } catch { return } }
    setShowErrors(false); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const trySubmit = () => {
    const firstBad = stepMissing.findIndex((m) => m.length)
    if (firstBad >= 0) { setShowErrors(true); setStep(firstBad); push(`Please complete: ${stepMissing[firstBad].map((f) => f.label).join(', ')}`, 'error'); return }
    submit.mutate()
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_1fr]">
      {/* Step list */}
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
        {editable && (
          <div className="mb-3 px-2 pt-1">
            <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-600">Completed</span><span className="font-semibold text-brand-700">{pct}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        <ol className="space-y-1">
          {steps.map((s, i) => {
            const Icon = ICONS[s.key] || FileText
            const done = stepMissing[i].length === 0
            return (
              <li key={s.key}>
                <button type="button" onClick={() => go(i)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${i === step ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? 'bg-emerald-100 text-emerald-700' : i === step ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {done ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">{s.title}</span>
                  {editable && !done && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">{stepMissing[i].length}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </aside>

      {/* Current step */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Step {step + 1} of {steps.length}</span>
          <h2 className="font-semibold text-slate-900">{cur.title}</h2>
        </header>
        <div className="p-6">
          {step === 0 && (
            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
              {[['Student Name', data.student_name], ['Student ID', data.student_number], ['Email Address', data.email]].map(([k, v]) => (
                <div key={k}><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</p><p className="truncate text-sm font-semibold text-slate-900">{v}</p></div>
              ))}
            </div>
          )}
          {cur.key !== 'resume' ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {cur.fields.filter((f) => visible(f, d)).map((f) => <Field key={f.key} f={f} d={d} set={set} disabled={!editable} showErrors={showErrors} />)}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Upload your latest resume as a PDF or DOCX. You can upload a newer version until you submit.</p>
              {data.resumes.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {data.resumes.map((r, i) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText size={18} className="text-brand-600" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{r.file_name}{i === 0 && <span className="ml-2 rounded bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">Latest</span>}</p><p className="text-xs text-slate-500">Version {r.version} · {fmtDateTime(r.uploaded_at)}</p></div>
                      <button onClick={() => downloadFile(`/v2/me/internship-form/resume/${r.id}`, r.file_name)} className="text-brand-700 hover:text-brand-900" aria-label="Download"><Download size={16} /></button>
                    </li>
                  ))}
                </ul>
              )}
              {editable && (
                <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center ${showErrors && !data.resumes.length ? 'border-red-300 bg-red-50/40' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}>
                  <Upload size={26} className="text-brand-600" />
                  <span className="text-sm font-medium text-slate-800">{upload.isPending ? 'Uploading…' : data.resumes.length ? 'Upload a new version' : 'Click to upload your resume'}</span>
                  <span className="text-xs text-slate-500">PDF or DOCX</span>
                  <input type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { e.target.files?.[0] && upload.mutate(e.target.files[0]); e.target.value = '' }} />
                </label>
              )}
              {editable && totalMissing > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="mb-1 font-semibold">Still to complete before you can submit:</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {steps.map((s, i) => stepMissing[i].length > 0 && <li key={s.key}><button className="underline" onClick={() => go(i)}>{s.title}</button> — {stepMissing[i].map((f) => f.label).join(', ')}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={15} /> Back</Button>
          <div className="flex flex-wrap items-center gap-2">
            {editable && <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => push('Draft saved', 'success') })}><Save size={15} /> Save draft</Button>}
            {!last && <Button onClick={() => go(step + 1)}>{editable ? 'Save & continue' : 'Next'} <ArrowRight size={15} /></Button>}
            {last && editable && <Button disabled={submit.isPending} onClick={trySubmit}><Send size={15} /> {submit.isPending ? 'Submitting…' : 'Submit form'}</Button>}
            {last && !editable && <Link to="/work" className="text-sm font-medium text-brand-700 hover:underline">View assigned work →</Link>}
          </div>
        </footer>
      </section>
    </div>
  )
}
