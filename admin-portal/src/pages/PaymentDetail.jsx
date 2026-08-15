import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

const STATUS_LABEL = { pending: 'Pending', paid: 'Successful', failed: 'Failed', refunded: 'Refunded' }
const STATUS_COLOR = { pending: 'yellow', paid: 'green', failed: 'red', refunded: 'slate' }

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value ?? '—'}</span>
    </div>
  )
}

export default function PaymentDetail() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payments', 'admin', 'detail', paymentId],
    queryFn: () => apiClient.get(`/payments/${paymentId}`).then((r) => r.data),
  })

  const markPaidMutation = useMutation({
    mutationFn: () => apiClient.post(`/payments/${paymentId}/mark-paid`, {}),
    onSuccess: () => {
      push('Payment marked paid — enrollment activated.', 'success')
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Failed to mark paid', 'error'),
  })

  if (isLoading) return <Spinner />
  if (!payment) return <p className="text-sm text-slate-500">Payment not found.</p>

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/payments')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Back to Payments
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Payment #{payment.id}</h1>
        <Badge color={STATUS_COLOR[payment.status]}>{STATUS_LABEL[payment.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Student</h2>
          <Row label="Name" value={payment.student_name} />
          <Row label="Student ID" value={payment.student_id} />
          <Row label="Email" value={payment.student_email} />
          <Row label="Internship Program" value={`${payment.program_name} (${payment.program_code})`} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Amount</h2>
          <Row label="Base Amount" value={`${payment.currency} ${payment.base_amount}`} />
          <Row label={payment.fee_type === 'gst' ? 'GST' : 'Platform Fee'} value={`${payment.currency} ${payment.fee_amount} (${payment.fee_percent}%)`} />
          <Row label="Total Paid" value={`${payment.currency} ${payment.total_amount}`} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Transaction</h2>
          <Row label="Payment Method" value={payment.payment_method.replace('_', ' ')} />
          <Row label="Razorpay Order ID" value={payment.razorpay_order_id} />
          <Row label="Razorpay Payment ID" value={payment.razorpay_payment_id} />
          <Row label="Created" value={new Date(payment.created_at).toLocaleString()} />
          <Row label="Paid At" value={payment.paid_at ? new Date(payment.paid_at).toLocaleString() : null} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Notes / Actions</h2>
          <Row label="Notes" value={payment.notes} />
          {payment.status === 'pending' && (
            <Button className="mt-4 w-full" onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending}>
              Mark Paid (offline payment)
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}
