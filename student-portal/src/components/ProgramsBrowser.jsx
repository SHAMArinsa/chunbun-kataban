import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Card from './ui/Card'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Spinner from './ui/Spinner'
import Modal from './ui/Modal'
import NdaAgreement from './NdaAgreement'
import RazorpayPayment from './RazorpayPayment'

export default function ProgramsBrowser() {
  const { push } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [flow, setFlow] = useState(null) // { program, enrollment, payment, phase: 'nda' | 'payment' }

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })
  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
    enabled: user?.role === 'student',
  })
  const { data: payments } = useQuery({
    queryKey: ['payments', 'me'],
    queryFn: () => apiClient.get('/payments/me').then((r) => r.data),
    enabled: user?.role === 'student',
  })
  const { data: ndaAcceptances } = useQuery({
    queryKey: ['nda', 'me'],
    queryFn: () => apiClient.get('/nda/me').then((r) => r.data),
    enabled: user?.role === 'student',
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    queryClient.invalidateQueries({ queryKey: ['payments'] })
    queryClient.invalidateQueries({ queryKey: ['nda'] })
  }

  const enrollMutation = useMutation({
    mutationFn: (programId) => apiClient.post('/enrollments', { program_id: programId }).then((r) => r.data),
    onError: (err) => push(err.response?.data?.detail || 'Enrollment failed', 'error'),
  })

  const beginFlow = async (program, existingEnrollment) => {
    let enrollment = existingEnrollment
    if (!enrollment) {
      try {
        enrollment = await enrollMutation.mutateAsync(program.id)
        refreshAll()
      } catch {
        return
      }
    }
    const payment = payments?.find((p) => p.enrollment_id === enrollment.id)
    const alreadySigned = ndaAcceptances?.some((n) => n.enrollment_id === enrollment.id)
    setFlow({ program, enrollment, payment, phase: alreadySigned ? 'payment' : 'nda' })
  }

  const handleNdaAccept = async (signatureName) => {
    try {
      await apiClient.post('/nda/accept', { enrollment_id: flow.enrollment.id, signature_name: signatureName })
      const { data: freshPayments } = await apiClient.get('/payments/me')
      const payment = freshPayments.find((p) => p.enrollment_id === flow.enrollment.id)
      setFlow((f) => ({ ...f, payment, phase: 'payment' }))
      refreshAll()
    } catch (err) {
      push(err.response?.data?.detail || 'NDA acceptance failed', 'error')
    }
  }

  const handlePaymentSuccess = () => {
    push('Payment successful — program activated!', 'success')
    setFlow(null)
    refreshAll()
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {programs?.map((p) => {
          const enrollment = enrollments?.find((e) => e.program_id === p.id)
          const payment = payments?.find((pay) => pay.enrollment_id === enrollment?.id)
          const isPaid = payment?.status === 'paid'
          return (
            <Card key={p.id} className="flex flex-col p-5">
              <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{p.duration_weeks} weeks</p>
              <p className="mt-3 text-2xl font-bold text-brand-700">₹{p.price_inr} <span className="text-sm font-normal text-slate-400">/ ${p.price_usd}</span></p>
              <ul className="mt-3 flex-1 space-y-1 text-xs text-slate-600">
                {(p.features?.highlights ?? []).slice(0, 3).map((h, i) => (
                  <li key={i}>• {h}</li>
                ))}
              </ul>
              <div className="mt-4 space-y-2">
                {enrollment && <Badge color={enrollment.status === 'active' ? 'green' : 'yellow'}>{enrollment.status.replace('_', ' ')}</Badge>}
                {!enrollment && (
                  <Button className="w-full" disabled={enrollMutation.isPending} onClick={() => beginFlow(p, null)}>
                    Enroll Now
                  </Button>
                )}
                {enrollment && !isPaid && (
                  <Button className="w-full" onClick={() => beginFlow(p, enrollment)}>
                    Complete Payment
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={!!flow}
        onClose={() => setFlow(null)}
        title={flow?.phase === 'nda' ? 'Sign NDA to Continue' : 'Complete Payment'}
        footer={null}
      >
        {flow?.phase === 'nda' && <NdaAgreement fullName={user?.full_name} onAccept={handleNdaAccept} />}
        {flow?.phase === 'payment' && flow?.payment && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{flow.program.name}</p>
              <p className="text-slate-500">Amount due: {flow.payment.currency} {flow.payment.total_amount}</p>
            </div>
            <RazorpayPayment
              paymentId={flow.payment.id}
              studentName={user?.full_name}
              studentEmail={user?.email}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
