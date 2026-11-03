import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import ProgramsBrowser from '../components/ProgramsBrowser'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import RazorpayPayment from '../components/RazorpayPayment'
import { useV2Status } from '../lib/v2'

// Spec 1.4: a student who registered and verified OTP but has not paid is sent
// straight back to the payment step for their chosen program.
function PendingPayment({ paymentId, user, onDone }) {
  const { data: payments } = useQuery({ queryKey: ['payments', 'me'], queryFn: () => apiClient.get('/payments/me').then((r) => r.data) })
  const { data: enrollments } = useQuery({ queryKey: ['enrollments', 'me'], queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data) })
  const payment = payments?.find((p) => p.id === paymentId)
  const enrollment = enrollments?.find((e) => e.id === payment?.enrollment_id)
  if (!payment) return <Spinner />
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Payment pending</h2>
      <p className="mt-1 text-sm text-slate-500">Your account is ready. Complete payment to activate your enrollment and open your dashboard.</p>
      <div className="my-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-900">{enrollment?.program_name || 'Selected program'}</p>
        <p className="text-slate-500">Amount due: {payment.currency} {payment.total_amount} (incl. {payment.fee_type === 'gst' ? 'GST' : 'international fee'})</p>
      </div>
      <RazorpayPayment paymentId={payment.id} studentName={user?.full_name} studentEmail={user?.email} onSuccess={onDone} />
    </div>
  )
}

const ACTIVE_STATUSES = ['active', 'completed']
const hasActiveEnrollmentCheck = (rows) => rows?.some((e) => ACTIVE_STATUSES.includes(e.status))

export default function CompleteEnrollment() {
  const { user, logout } = useAuth()
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })

  const { data: status, isLoading: statusLoading, refetch } = useV2Status()
  if (isLoading || statusLoading) return <Spinner className="min-h-screen" />
  if (status?.portal === 'v2' && status.access !== 'pending_payment' && hasActiveEnrollmentCheck(enrollments)) return <Navigate to="/dashboard" replace />

  const hasActiveEnrollment = enrollments?.some((e) => ACTIVE_STATUSES.includes(e.status))
  const isSuspended = !hasActiveEnrollment && enrollments?.some((e) => e.status === 'suspended')
  if (isSuspended) return <Navigate to="/support" replace />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-brand-700">ARINSA AI MINDS</p>
          <p className="text-xs text-slate-500">Student Portal</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-medium text-slate-900">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <Button variant="ghost" onClick={logout}>Logout</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Complete Your Enrollment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a program and complete payment to unlock your Student Portal — materials, quizzes, coding
            work, projects, and more become available once your enrollment is active.
          </p>
        </div>
        {status?.pending_payment_id
          ? <PendingPayment paymentId={status.pending_payment_id} user={user} onDone={() => { refetch(); window.location.assign('/dashboard') }} />
          : <ProgramsBrowser />}
      </main>
    </div>
  )
}
