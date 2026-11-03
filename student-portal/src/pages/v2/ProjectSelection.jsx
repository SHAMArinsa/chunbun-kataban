import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2, Circle, Download, Lock, X } from 'lucide-react'
import apiClient from '../../api/client'
import ProtectedContent from '../../components/proctoring/ProtectedContent'
import Button from '../../components/ui/Button'
import FilePreview from '../../components/ui/FilePreview'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { downloadFile, errorText } from '../../lib/v2'

export default function ProjectSelection() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [picks, setPicks] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [doc, setDoc] = useState('details')
  const { data, isLoading, error } = useQuery({ queryKey: ['v2', 'options'], queryFn: () => apiClient.get('/v2/me/project-options').then((r) => r.data) })
  const confirm = useMutation({
    mutationFn: (ids) => apiClient.post('/v2/me/project-selection', { project_ids: ids }),
    onSuccess: () => { push('Project selection confirmed and locked.', 'success'); setConfirming(false); qc.invalidateQueries({ queryKey: ['v2'] }) },
    onError: (e) => push(errorText(e), 'error'),
  })
  if (isLoading) return <Spinner />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorText(error)}</p>

  const required = data.required
  const chosen = picks
  const valid = chosen.length === required
  const togglePick = (id) => {
    if (picks.includes(id)) { setPicks(picks.filter((p) => p !== id)); return }
    const next = required === 1 ? [id] : picks.length < required ? [...picks, id] : null
    if (!next) { push(`You can select only ${required} projects. Remove one first.`, 'error'); return }
    setPicks(next)
    if (next.length === required) setConfirming(true)
  }
  const byId = Object.fromEntries(data.options.map((o) => [o.id, o]))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Project Selection</h1>
        {data.confirmed ? (
          <p className="text-sm text-slate-500">Your project selection is locked. Only your selected project is shown below.</p>
        ) : (
        <p className="text-sm text-slate-500">
          Read all project options, then select <b>exactly {required === 1 ? 'one project' : 'two different projects'}</b>.
          {required === 2 && ' Both projects are mandatory. Requirements primarily use FastAPI + React + PostgreSQL.'} Once you confirm, your choice is locked — only an administrator can change it.
        </p>
        )}
      </div>

      {data.confirmed && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <Lock size={18} className="mt-0.5 shrink-0" />
          <div>
            Your selection is confirmed and locked: <b>{data.selected_project_ids.map((id) => byId[id]?.title).join(' and ')}</b>.
            {' '}Go to <Link className="underline" to="/work">Project Submission</Link> to submit your work.
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.options.length === 0 && <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Project options will be published by ARINSA AI MINDS soon.</p>}
        {data.options.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {data.options.map((o) => {
              const mine = data.selected_project_ids.includes(o.id)
              const picked = picks.includes(o.id)
              return (
                <li key={o.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${mine ? 'bg-emerald-50/60' : picked ? 'bg-brand-50' : ''}`}>
                  {data.confirmed ? (mine ? <CheckCircle2 size={22} className="shrink-0 text-emerald-600" /> : <Circle size={22} className="shrink-0 text-slate-300" />) : (
                    <button type="button" onClick={() => togglePick(o.id)} aria-pressed={picked} aria-label={`Select ${o.title}`}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${picked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-400 bg-white hover:border-brand-500'}`}>
                      {picked && <Check size={14} strokeWidth={3} />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => !data.confirmed && togglePick(o.id)}>
                    <p className="font-semibold text-slate-900">{o.title}{mine && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">Your project</span>}</p>
                    {o.technology && <p className="text-xs text-slate-500">{o.technology}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(o.has_resource_file || o.has_instructions_file || o.description) && (
                      <button onClick={() => { setViewing(o); setDoc('details') }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:border-brand-400">
                        View Project <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!data.confirmed && confirming && valid && (
          <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900">Do you want to continue?</h2>
              <p className="mt-2 text-sm text-slate-700">You have selected <b>{chosen.map((id) => byId[id]?.title).join(' and ')}</b>.</p>
              <p className="mt-2 text-sm text-amber-700">Once you proceed, your choice is locked and you <b>cannot switch</b> to another project. Only an administrator can change it.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setConfirming(false); setPicks(required === 1 ? [] : picks.slice(0, -1)) }}>Back</Button>
                <Button disabled={confirm.isPending} onClick={() => confirm.mutate(chosen)}>{confirm.isPending ? 'Saving…' : 'Proceed'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
        {viewing && (
          <ProtectedContent key={viewing.id} resourceId={`v2-project-${viewing.id}`} viewLabel="View Project" onCancel={() => setViewing(null)}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{viewing.title}</p>
                {viewing.technology && <p className="text-xs text-slate-500">{viewing.technology}</p>}
              </div>
              <Button variant="secondary" onClick={() => setViewing(null)}><X size={16} /> Back to all projects</Button>
            </div>
            {viewing.has_resource_file && viewing.has_instructions_file && (
              <div className="flex gap-1 border-b border-slate-100 px-5 pt-2" role="tablist">
                {[['details', 'Project details & requirements'], ['instructions', 'Instructions']].map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={doc === k} onClick={() => setDoc(k)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${doc === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>
                ))}
              </div>
            )}
            <div className="p-4">
              {viewing.has_resource_file || viewing.has_instructions_file ? (
                <FilePreview key={`${viewing.id}-${doc}`}
                  fetcher={() => apiClient.get(`/v2/me/work/${viewing.id}/resource`, { responseType: 'blob', params: { kind: viewing.has_resource_file ? doc : 'instructions' } })}
                  fileName={`${viewing.title}.pdf`} />
              ) : (
                <div className="space-y-2 text-sm text-slate-700">
                  {viewing.description && <p className="whitespace-pre-wrap">{viewing.description}</p>}
                  {viewing.instructions && <p className="whitespace-pre-wrap text-slate-500"><b>Instructions:</b> {viewing.instructions}</p>}
                </div>
              )}
            </div>
          </div>
          </ProtectedContent>
        )}

    </div>
  )
}
