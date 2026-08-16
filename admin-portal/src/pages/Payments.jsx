import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'

const STATUS_LABEL = { pending: 'Pending', paid: 'Successful', failed: 'Failed', refunded: 'Refunded' }
const STATUS_COLOR = { pending: 'yellow', paid: 'green', failed: 'red', refunded: 'slate' }

export default function Payments() {
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ search: '', status_filter: '', program_id: '', date_from: '', date_to: '' })

  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', 'admin', activeFilters],
    queryFn: () => apiClient.get('/payments', { params: activeFilters }).then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  const markPaidMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/payments/${id}/mark-paid`, {}),
    onSuccess: () => {
      push('Payment marked paid — enrollment activated.', 'success')
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Failed to mark paid', 'error'),
  })

  const totals = (payments ?? []).reduce(
    (acc, p) => {
      if (p.status === 'paid') acc.revenue += Number(p.total_amount)
      acc[p.status] = (acc[p.status] ?? 0) + 1
      return acc
    },
    { revenue: 0 }
  )

  const downloadInvoice = async (payment) => {
    try {
      const response = await apiClient.get(`/payments/${payment.id}/invoice`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `ARINSA-${String(payment.id).padStart(6, '0')}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      push(err.response?.data?.detail || 'Could not generate the invoice', 'error')
    }
  }

  const columns = [
    { key: 'student_name', header: 'Student', render: (r) => <button className="text-brand-700 hover:underline" onClick={() => navigate(`/payments/${r.id}`)}>{r.student_name}</button> },
    { key: 'student_id', header: 'Student ID' },
    { key: 'student_email', header: 'Email' },
    { key: 'program_name', header: 'Program' },
    { key: 'total_amount', header: 'Total Paid', render: (r) => `${r.currency} ${r.total_amount}` },
    { key: 'payment_method', header: 'Method', render: (r) => r.payment_method.replace('_', ' ') },
    { key: 'razorpay_payment_id', header: 'Razorpay Payment ID', render: (r) => r.razorpay_payment_id || '—' },
    { key: 'created_at', header: 'Date', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'status', header: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    {
      key: 'action',
      header: '',
      render: (r) => (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/payments/${r.id}`)}>View</Button>
          {r.status === 'paid' && <Button variant="secondary" onClick={() => downloadInvoice(r)}>Invoice</Button>}
          {r.status === 'pending' && (
            <Button onClick={() => markPaidMutation.mutate(r.id)} disabled={markPaidMutation.isPending}>Mark Paid</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Payment Management</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Total Revenue (Successful)</p><p className="text-xl font-semibold text-slate-900">₹{totals.revenue.toLocaleString()}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Successful</p><p className="text-xl font-semibold text-emerald-600">{totals.paid ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Pending</p><p className="text-xl font-semibold text-amber-600">{totals.pending ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Failed</p><p className="text-xl font-semibold text-red-600">{totals.failed ?? 0}</p></Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Search name, email, payment/order ID…" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
          <Select value={filters.status_filter} onChange={(e) => setFilters((f) => ({ ...f, status_filter: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Successful</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
          <Select value={filters.program_id} onChange={(e) => setFilters((f) => ({ ...f, program_id: e.target.value }))}>
            <option value="">All Programs</option>
            {programs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
          <Input type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
        </div>
      </Card>

      <Card>{isLoading ? <Spinner /> : <Table columns={columns} rows={payments} emptyMessage="No payments match these filters." />}</Card>
    </div>
  )
}
