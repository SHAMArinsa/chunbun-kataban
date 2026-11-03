import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, Download, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, Info, Pencil, Send, Trash2, X, XCircle } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { Pill, downloadFile, errorText, fmtDate, fmtDateTime, humanize } from '../../lib/v2'

const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const dayStart = (iso) => `${iso}T00:00`
const dayEnd = (iso) => `${iso}T23:59`


// 30-minute slots offered in the picker (local time)
const SLOT_TIMES = Array.from({ length: 26 }, (_, i) => { const m = 9 * 60 + i * 30; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}` }) // 09:00 – 21:30
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const niceTime = (t) => new Date(t).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function SlotPicker({ earliest, latest, taken, onPick }) {
  const first = new Date(`${earliest}T00:00`)
  const [view, setView] = useState(new Date(first.getFullYear(), first.getMonth(), 1))
  const [day, setDay] = useState(null)
  const y = view.getFullYear(), mo = view.getMonth()
  const startPad = (new Date(y, mo, 1).getDay() + 6) % 7 // Monday first
  const daysIn = new Date(y, mo + 1, 0).getDate()
  const cells = Array.from({ length: startPad }, () => null).concat(Array.from({ length: daysIn }, (_, i) => isoDay(new Date(y, mo, i + 1))))
  const okDay = (d) => d >= earliest && (!latest || d <= latest)
  const canPrev = new Date(y, mo, 1) > new Date(first.getFullYear(), first.getMonth(), 1)
  const canNext = !latest || new Date(y, mo + 1, 1) <= new Date(`${latest}T00:00`)
  const takenDays = new Set(taken.map((t) => t.slice(0, 10)))
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" disabled={!canPrev} onClick={() => setView(new Date(y, mo - 1, 1))} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={18} /></button>
          <p className="text-base font-semibold text-slate-900">{view.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p>
          <button type="button" disabled={!canNext} onClick={() => setView(new Date(y, mo + 1, 1))} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-400">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => d ? (
            <button key={d} type="button" disabled={!okDay(d)} onClick={() => setDay(d)} aria-pressed={day === d}
              className={`relative h-12 rounded-lg text-sm font-medium transition ${day === d ? 'bg-brand-600 text-white' : okDay(d) ? 'bg-brand-50/60 text-slate-800 hover:bg-brand-100' : 'text-slate-300'}`}>
              {Number(d.slice(8))}
              {takenDays.has(d) && <span className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${day === d ? 'bg-white' : 'bg-brand-600'}`} />}
            </button>
          ) : <span key={`p${i}`} />)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">{day ? `Time · ${new Date(`${day}T00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Time — pick a date first'}</p>
        {day && (
          <div className="grid max-h-[380px] grid-cols-3 gap-2 overflow-y-auto pr-1">
            {SLOT_TIMES.map((t) => {
              const v = `${day}T${t}`
              const used = taken.includes(v)
              return (
                <button key={t} type="button" disabled={used} onClick={() => onPick(v)}
                  className={`h-11 rounded-lg border text-sm font-medium transition ${used ? 'border-brand-200 bg-brand-50 text-brand-400' : 'border-slate-200 text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700'}`}>
                  {new Date(`2000-01-01T${t}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function RequestForm({ slot, window: w, initial, onDone, onCancel }) {
  const { push } = useToast()
  const [times, setTimes] = useState(() => (initial?.preferred_times || []).map((t) => toLocalInput(new Date(t))).concat(Array(5).fill('')).slice(0, 5))
  const [note, setNote] = useState(initial?.note || '')
  const min = dayStart(w.earliest)
  const max = w.latest ? dayEnd(w.latest) : undefined
  const errs = times.map((t, i) => {
    if (!t) return ''
    if (t < min) return `Must be on or after ${fmtDate(w.earliest)}`
    if (max && t > max) return `Must be on or before ${fmtDate(w.latest)}`
    if (times.findIndex((x) => x === t) !== i) return 'Duplicate timing'
    return ''
  })
  const filled = times.filter(Boolean).length
  const ready = filled === 5 && errs.every((e) => !e)
  const send = useMutation({
    mutationFn: () => apiClient.put(`/v2/me/mock-interviews/${slot.number}/request`, { preferred_times: times.map((t) => new Date(t).toISOString()), note: note || null }),
    onSuccess: () => { push('Preferred timings sent to ARINSA AI MINDS', 'success'); onDone() },
    onError: (e) => push(errorText(e), 'error'),
  })
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,1fr)]">
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Choose <b>5 different timings</b> that suit you. ARINSA AI MINDS will confirm one of them.</p>
      <div className="space-y-2">
        {times.map((t, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${t ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'}`}>{i + 1}</span>
              <span className={`flex h-11 flex-1 items-center rounded-lg border px-3 text-sm ${errs[i] ? 'border-red-400' : t ? 'border-brand-200 bg-brand-50/40 text-slate-900' : 'border-dashed border-slate-300 text-slate-400'}`}>{t ? niceTime(t) : 'Not chosen yet'}</span>
              {t && <button type="button" onClick={() => setTimes(times.map((x, j) => (j === i ? '' : x)))} aria-label={`Remove timing ${i + 1}`} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600"><X size={16} /></button>}
            </div>
            {errs[i] && <p className="ml-9 mt-0.5 text-xs text-red-600">{errs[i]}</p>}
          </div>
        ))}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note for the team <span className="font-normal text-slate-400">(optional)</span></span>
        <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Weekday evenings work best for me" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!ready || send.isPending} onClick={() => send.mutate()}><Send size={15} /> {send.isPending ? 'Sending…' : initial ? 'Update timings' : 'Send timings'}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <span className="text-xs text-slate-500">{filled}/5 selected</span>
      </div>
    </div>
      {filled < 5 ? (
        <SlotPicker earliest={w.earliest} latest={w.latest} taken={times.filter(Boolean)}
          onPick={(v) => { const k = times.findIndex((x) => !x); if (k >= 0) setTimes(times.map((x, j) => (j === k ? v : x))) }} />
      ) : (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800 lg:col-span-2">
          <CheckCircle2 size={28} />
          <p className="font-semibold">All 5 timings chosen</p>
          <p>Remove one with ✕ to pick a different time, or press <b>Send timings</b>.</p>
        </div>
      )}
    </div>
  )
}

function Slot({ m, w, prevDone, onChanged }) {
  const { push } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const withdraw = useMutation({ mutationFn: () => apiClient.delete(`/v2/me/mock-interviews/${m.number}/request`), onSuccess: () => { push('Request withdrawn', 'success'); onChanged() }, onError: (e) => push(errorText(e), 'error') })
  const cancel = useMutation({ mutationFn: () => apiClient.post(`/v2/me/mock-interviews/${m.number}/cancel`), onSuccess: () => { push('Interview cancelled. You can send new timings.', 'success'); setConfirmCancel(false); onChanged() }, onError: (e) => push(errorText(e), 'error') })

  let pill = <Pill value="pending" label="Not requested" />
  if (m.scheduled) pill = <Pill value={m.status} />
  else if (m.request?.status === 'pending') pill = <Pill value="submitted" label="Awaiting confirmation" />

  const showForm = (!m.scheduled && prevDone && !(m.request?.status === 'pending' && !editing) && w.open) || m.scheduled
  return (
    <article className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${showForm ? 'lg:col-span-3' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Mock Interview {m.number}</h2>
        {pill}
      </div>
      {m.planned_for && <p className="mb-2 text-xs text-slate-500">Planned around {m.planned_for}</p>}

      {m.scheduled ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-brand-50/60 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500"><CalendarClock size={14} /> Date & time</p>
              <p className="mt-1 font-semibold text-slate-900">{fmtDateTime(m.scheduled_at || m.scheduled_date)}</p>
            </div>
            <div className="rounded-xl bg-brand-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Interviewer</p>
              <p className="mt-1 font-semibold text-slate-900">{m.interviewer || '—'}</p>
            </div>
            <div className="rounded-xl bg-brand-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.attendance ? 'Attendance' : 'Meeting'}</p>
              {m.attendance ? <p className="mt-1 font-semibold text-slate-900">{humanize(m.attendance)}</p>
                : m.meeting_link ? <a href={m.meeting_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Join meeting <ExternalLink size={14} /></a>
                : <p className="mt-1 text-slate-500">Link coming soon</p>}
            </div>
          </div>

          {m.result && m.result !== 'pending' && (
            <div className={`mt-4 flex items-center gap-3 rounded-xl border p-4 ${m.result === 'pass' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {m.result === 'pass' ? <CheckCircle2 size={28} className="shrink-0" /> : <XCircle size={28} className="shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Result</p>
                <p className="text-xl font-bold">{m.result === 'pass' ? 'Passed' : 'Not passed'}</p>
              </div>
              {m.meeting_link && m.attendance && <a href={m.meeting_link} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm hover:underline">Meeting link <ExternalLink size={13} /></a>}
            </div>
          )}

          {(m.technical_feedback || m.communication_feedback || m.overall_feedback) && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">Interviewer feedback</p>
              <div className="grid gap-3 md:grid-cols-3">
                {[['Technical', m.technical_feedback], ['Communication', m.communication_feedback], ['Overall', m.overall_feedback]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{k}</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{v || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {m.files?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">Feedback files</p>
              <div className="flex flex-wrap gap-2">
                {m.files.map((f) => (
                  <button key={f.id} type="button" onClick={() => downloadFile(`/v2/me/mock-interview-files/${f.id}/download`, f.name)}
                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-400 hover:text-brand-700">
                    <Download size={15} className="shrink-0 text-brand-600" /><span className="truncate">{f.name}</span>
                    {f.size ? <span className="text-xs text-slate-400">{f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}
          {['scheduled', 'rescheduled'].includes(m.status) && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              {m.can_cancel ? (
                confirmCancel ? (
                  <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    <p>Cancel this interview? You'll need to send new timings (at least {w.lead_days} days ahead).</p>
                    <div className="flex gap-2"><Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Yes, cancel</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep it</Button></div>
                  </div>
                ) : <button onClick={() => setConfirmCancel(true)} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"><XCircle size={14} /> Cancel interview</button>
              ) : <p className="flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} /> Less than {w.cutoff_days} days to go — this interview can no longer be cancelled.</p>}
            </div>
          )}
        </>
      ) : !prevDone ? (
        <p className="text-sm text-slate-500">You can request this slot after Mock Interview {m.number - 1} is completed.</p>
      ) : m.request?.status === 'pending' && !editing ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Your preferred timings — ARINSA AI MINDS will confirm one and you'll get a notification.</p>
          <ol className="space-y-1.5">
            {m.request.preferred_times.map((t, i) => (
              <li key={t} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">{i + 1}</span>
                <CalendarClock size={14} className="text-slate-400" /> {fmtDateTime(t)}
              </li>
            ))}
          </ol>
          {m.request.note && <p className="text-xs text-slate-500">Note: {m.request.note}</p>}
          <div className="flex gap-3 text-sm">
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Pencil size={13} /> Change timings</button>
            <button onClick={() => withdraw.mutate()} className="inline-flex items-center gap-1 text-red-600 hover:underline"><Trash2 size={13} /> Withdraw</button>
          </div>
        </div>
      ) : !w.open ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>The booking window has closed: interviews must be requested {w.lead_days} days ahead and finished by {fmtDate(w.latest)}. Please contact Support.</span>
        </div>
      ) : (
        <>
          {m.was_cancelled && <p className="mb-2 text-xs text-amber-700">Your previous booking was cancelled — please send new timings.</p>}
          <RequestForm slot={m} window={w} initial={editing ? m.request : null} onDone={() => { setEditing(false); onChanged() }} onCancel={editing ? () => setEditing(false) : null} />
        </>
      )}
    </article>
  )
}

export default function MockInterviews() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['v2', 'mocks'], queryFn: () => apiClient.get('/v2/me/mock-interviews').then((r) => r.data) })
  if (isLoading) return <Spinner />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorText(error)}</p>
  const w = data.window
  const refresh = () => qc.invalidateQueries({ queryKey: ['v2', 'mocks'] })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mock Interviews</h1>
        <p className="mt-1 text-sm text-slate-500">Send 5 preferred timings and ARINSA AI MINDS will schedule your interview.</p>
      </div>

      <section className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Info size={16} className="text-brand-700" /> Booking rules</p>
        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-3">
          <li className="flex items-start gap-2"><CalendarPlus size={16} className="mt-0.5 shrink-0 text-brand-600" /><span>Request at least <b>{w.lead_days} days</b> in advance — earliest timing you can pick: <b>{fmtDate(w.earliest)}</b>.</span></li>
          <li className="flex items-start gap-2"><Clock size={16} className="mt-0.5 shrink-0 text-brand-600" /><span>Interviews can't be scheduled or cancelled less than <b>{w.cutoff_days} days</b> before the time.</span></li>
          <li className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" /><span>Finish your interview <b>{w.end_buffer_days} days</b> before your internship ends{w.latest ? <> — last possible date: <b>{fmtDate(w.latest)}</b></> : ''}.</span></li>
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.interviews.map((m, i) => (
          <Slot key={m.number} m={m} w={w} onChanged={refresh}
            prevDone={i === 0 || data.interviews[i - 1].status === 'completed'} />
        ))}
      </div>
    </div>
  )
}
