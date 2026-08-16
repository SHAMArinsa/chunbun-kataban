import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

function EditProgramModal({ program, onClose }) {
  const [form, setForm] = useState({
    price_inr: program.price_inr,
    price_usd: program.price_usd,
    offer_price_inr: program.offer_price_inr ?? '',
    offer_price_usd: program.offer_price_usd ?? '',
    offer_start_date: program.offer_start_date ?? '',
    offer_end_date: program.offer_end_date ?? '',
    duration_weeks: program.duration_weeks,
    gst_percent: program.gst_percent,
    platform_fee_percent: program.platform_fee_percent,
    is_active: program.is_active,
  })
  const { push } = useToast()
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (payload) => apiClient.put(`/programs/${program.id}`, payload),
    onSuccess: () => {
      push('Program updated!', 'success')
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      onClose()
    },
    onError: () => push('Update failed', 'error'),
  })

  const save = () => {
    const hasOffer = form.offer_price_inr !== '' || form.offer_price_usd !== '' || form.offer_start_date || form.offer_end_date
    if (hasOffer && (!form.offer_price_inr || !form.offer_price_usd || !form.offer_start_date || !form.offer_end_date)) {
      push('Enter both offer prices and the offer start/end dates.', 'error')
      return
    }
    if (form.offer_end_date && form.offer_end_date < form.offer_start_date) {
      push('Offer end date cannot be before the start date.', 'error')
      return
    }
    updateMutation.mutate({ ...form, offer_price_inr: form.offer_price_inr === '' ? null : Number(form.offer_price_inr), offer_price_usd: form.offer_price_usd === '' ? null : Number(form.offer_price_usd), offer_start_date: form.offer_start_date || null, offer_end_date: form.offer_end_date || null })
  }

  return (
    <Modal open title={`Edit: ${program.name}`} onClose={onClose} footer={<Button onClick={save} disabled={updateMutation.isPending}>Save</Button>}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Price (INR)" type="number" value={form.price_inr} onChange={(e) => setForm((f) => ({ ...f, price_inr: Number(e.target.value) }))} />
        <Input label="Price (USD)" type="number" value={form.price_usd} onChange={(e) => setForm((f) => ({ ...f, price_usd: Number(e.target.value) }))} />
        <Input label="Duration (weeks)" type="number" value={form.duration_weeks} onChange={(e) => setForm((f) => ({ ...f, duration_weeks: Number(e.target.value) }))} />
        <Input label="GST %" type="number" value={form.gst_percent} onChange={(e) => setForm((f) => ({ ...f, gst_percent: Number(e.target.value) }))} />
        <Input label="Platform Fee %" type="number" value={form.platform_fee_percent} onChange={(e) => setForm((f) => ({ ...f, platform_fee_percent: Number(e.target.value) }))} />
        <Input label="Offer Price (INR)" type="number" min="0" value={form.offer_price_inr} onChange={(e) => setForm((f) => ({ ...f, offer_price_inr: e.target.value }))} />
        <Input label="Offer Price (USD)" type="number" min="0" value={form.offer_price_usd} onChange={(e) => setForm((f) => ({ ...f, offer_price_usd: e.target.value }))} />
        <Input label="Offer Start Date" type="date" value={form.offer_start_date} onChange={(e) => setForm((f) => ({ ...f, offer_start_date: e.target.value }))} />
        <Input label="Offer End Date" type="date" value={form.offer_end_date} onChange={(e) => setForm((f) => ({ ...f, offer_end_date: e.target.value }))} />
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Active
        </label>
      </div>
    </Modal>
  )
}

export default function Programs() {
  const [editing, setEditing] = useState(null)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })
  const { data: pendingPayments } = useQuery({
    queryKey: ['payments', 'pending'],
    queryFn: () => apiClient.get('/payments', { params: { status_filter: 'pending' } }).then((r) => r.data),
  })

  const markPaidMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/payments/${id}/mark-paid`, {}),
    onSuccess: () => {
      push('Payment marked paid — enrollment activated.', 'success')
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  if (isLoading) return <Spinner />

  const paymentColumns = [
    { key: 'id', header: 'Payment ID' },
    { key: 'student_id', header: 'Student ID' },
    { key: 'currency', header: 'Currency' },
    { key: 'total_amount', header: 'Amount', render: (r) => `${r.currency} ${r.total_amount}` },
    { key: 'status', header: 'Status', render: (r) => <Badge color="yellow">{r.status}</Badge> },
    { key: 'action', header: '', render: (r) => <Button onClick={() => markPaidMutation.mutate(r.id)}>Mark Paid</Button> },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Internship Plans</h1>
        <p className="text-sm text-slate-500">Manage pricing, features, and duration for each program.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {programs?.map((p) => (
          <Card key={p.id} className="flex flex-col p-5">
            <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{p.duration_weeks} weeks</p>
            <p className="mt-3 text-xl font-bold text-brand-700">₹{p.price_inr} / ${p.price_usd}</p>
            {p.offer_price_inr && <p className="mt-1 text-xs text-emerald-700">Offer: ₹{p.offer_price_inr} / ${p.offer_price_usd} ({p.offer_start_date} to {p.offer_end_date})</p>}
            <p className="mt-1 text-xs text-slate-400">GST {p.gst_percent}% · Platform fee {p.platform_fee_percent}%</p>
            <Badge color={p.is_active ? 'green' : 'slate'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
            <Button variant="secondary" className="mt-4" onClick={() => setEditing(p)}>Edit</Button>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Pending Payments</h2>
        <Card>
          <Table columns={paymentColumns} rows={pendingPayments} emptyMessage="No pending payments." />
        </Card>
      </div>

      {editing && <EditProgramModal program={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
