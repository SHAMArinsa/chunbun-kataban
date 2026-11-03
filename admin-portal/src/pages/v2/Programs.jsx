import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Tag } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import { KeyValues, PageHeader, Status, TextArea } from '../../components/v2/Kit'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { durationLabel, errorText, fmtDateTime, humanize, money } from '../../lib/v2'

const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

export default function Programs() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const { push } = useToast()
  const [edit, setEdit] = useState(null) // {program, mode: info|pricing|offer}
  const [f, setF] = useState({})
  const { data, isLoading } = useQuery({ queryKey: ['v2', 'programs'], queryFn: () => apiClient.get('/v2/staff/programs').then((r) => r.data) })
  const save = useMutation({
    mutationFn: ({ url, body }) => apiClient.put(url, body),
    onSuccess: () => { push('Program updated', 'success'); setEdit(null); qc.invalidateQueries({ queryKey: ['v2', 'programs'] }) },
    onError: (e) => push(errorText(e), 'error'),
  })
  if (isLoading) return <Spinner />
  const open = (program, mode) => {
    setEdit({ program, mode })
    if (mode === 'info') setF({ name: program.name, description: program.description || '', duration: program.duration, is_active: program.is_active, mcq_enabled: program.mcq_enabled })
    if (mode === 'pricing') setF({ price_inr: program.price_inr, price_usd: program.price_usd, gst_percent: program.gst_percent, platform_fee_percent: program.platform_fee_percent })
    if (mode === 'offer') setF({ offer_enabled: program.offer_enabled, offer_price_inr: program.offer_price_inr ?? '', offer_price_usd: program.offer_price_usd ?? '', offer_start_at: toLocal(program.offer_start_at), offer_end_at: toLocal(program.offer_end_at) })
  }
  const submit = () => {
    const id = edit.program.id
    if (edit.mode === 'info') {
      const body = { name: f.name, description: f.description, duration: Number(f.duration) }
      if (isAdmin) body.is_active = f.is_active
      if (edit.program.is_v2) body.mcq_enabled = f.mcq_enabled
      save.mutate({ url: `/v2/staff/programs/${id}`, body })
    } else if (edit.mode === 'pricing') {
      save.mutate({ url: `/v2/staff/programs/${id}/pricing`, body: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)])) })
    } else {
      const num = (v) => (v === '' || v == null ? null : Number(v))
      save.mutate({
        url: `/v2/staff/programs/${id}/offer`,
        body: {
          offer_enabled: f.offer_enabled, offer_price_inr: num(f.offer_price_inr), offer_price_usd: num(f.offer_price_usd),
          offer_start_at: f.offer_start_at ? new Date(f.offer_start_at).toISOString() : null,
          offer_end_at: f.offer_end_at ? new Date(f.offer_end_at).toISOString() : null,
        },
      })
    }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const v2 = data.filter((p) => p.is_v2)
  const legacy = data.filter((p) => !p.is_v2)
  return (
    <div className="space-y-6">
      <PageHeader title="Programs" subtitle={isAdmin ? 'Program details, standard prices and time-limited offers.' : 'Program details. Pricing is managed by Admin.'} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {v2.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">{p.name}</h2>
                <p className="text-xs text-slate-500">{durationLabel(p.duration, p.duration_unit)} · {p.enrolled} enrolled</p>
              </div>
              <Status value={p.is_active ? 'active' : 'draft'} label={p.is_active ? 'Active' : 'Inactive'} />
            </div>
            <p className="mb-4 line-clamp-3 text-sm text-slate-600">{p.description}</p>
            {isAdmin && (
              <div className="mb-4 rounded-lg bg-slate-50 p-3">
                <KeyValues items={[
                  ['Regular (INR)', money(p.price_inr)], ['Regular (Intl.)', money(p.price_usd, 'USD')],
                  ['Charged now (INR)', <span key="c" className={p.offer_live ? 'text-emerald-700' : ''}>{money(p.current_price_inr)}{p.offer_live && ' (offer)'}</span>],
                  ['GST', `${p.gst_percent}%`], ['Intl. fee', `${p.platform_fee_percent}%`],
                  p.offer_enabled && ['Offer window', `${fmtDateTime(p.offer_start_at)} → ${fmtDateTime(p.offer_end_at)}`],
                ]} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => open(p, 'info')}><Pencil size={14} /> Details</Button>
              {isAdmin && <Button variant="secondary" onClick={() => open(p, 'pricing')}>₹ Pricing</Button>}
              {isAdmin && <Button variant="secondary" onClick={() => open(p, 'offer')}><Tag size={14} /> Offer</Button>}
            </div>
          </Card>
        ))}
      </div>
      {legacy.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Legacy programs (existing students only)</h2>
          <div className="flex flex-wrap gap-3">
            {legacy.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {p.name} <Status value={p.is_active ? 'active' : 'draft'} label={p.is_active ? 'Open for signup' : 'Closed for signup'} />
                <span className="text-xs text-slate-400">{p.enrolled} enrolled</span>
                {isAdmin && <button onClick={() => open(p, 'info')} className="text-slate-400 hover:text-brand-700"><Pencil size={13} /></button>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit && `${edit.program.name} – ${humanize(edit.mode)}`} footer={<Button disabled={save.isPending} onClick={submit}>Save</Button>}>
        {edit?.mode === 'info' && (
          <div className="space-y-3">
            <Input label="Program name" value={f.name} onChange={set('name')} />
            <TextArea label="Description" value={f.description} onChange={set('description')} />
            <Input label={`Duration (${edit.program.duration_unit}) – applies to new enrollments`} type="number" value={f.duration} onChange={set('duration')} />
            {isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={set('is_active')} /> Active (open for new registrations)</label>}
            {edit.program.is_v2 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.mcq_enabled} onChange={set('mcq_enabled')} /> MCQ assessment enabled for this program</label>}
          </div>
        )}
        {edit?.mode === 'pricing' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Standard price (INR)" type="number" value={f.price_inr} onChange={set('price_inr')} />
            <Input label="Standard price (International, USD)" type="number" value={f.price_usd} onChange={set('price_usd')} />
            <Input label="GST % (Indian students)" type="number" value={f.gst_percent} onChange={set('gst_percent')} />
            <Input label="International fee %" type="number" value={f.platform_fee_percent} onChange={set('platform_fee_percent')} />
          </div>
        )}
        {edit?.mode === 'offer' && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!f.offer_enabled} onChange={set('offer_enabled')} /> Offer active</label>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Offer price (INR)" type="number" value={f.offer_price_inr} onChange={set('offer_price_inr')} />
              <Input label="Offer price (International, USD)" type="number" value={f.offer_price_usd} onChange={set('offer_price_usd')} />
              <Input label="Offer starts" type="datetime-local" value={f.offer_start_at} onChange={set('offer_start_at')} />
              <Input label="Offer ends" type="datetime-local" value={f.offer_end_at} onChange={set('offer_end_at')} />
            </div>
            <p className="text-xs text-slate-500">Before the start: regular price. During the window: offer price. After the end: automatically back to the regular price. Times use your computer’s time zone. The server always calculates the amount charged.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
