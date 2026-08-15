import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router-dom'
import apiClient from '../api/client'
import Spinner from './ui/Spinner'

const ACTIVE_STATUSES = ['active', 'completed']

// Guards every route nested under the dashboard Layout. Students with no paid enrollment
// never see the portal shell (sidebar etc.) at all — they're sent to the standalone
// /complete-enrollment page instead, which lives outside Layout entirely. Suspended
// students are sent to /support instead, which is exempt from this gate.
export default function PaymentGate() {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })

  if (isLoading) return <Spinner className="min-h-screen" />

  const hasActiveEnrollment = enrollments?.some((e) => ACTIVE_STATUSES.includes(e.status))
  const isSuspended = !hasActiveEnrollment && enrollments?.some((e) => e.status === 'suspended')

  if (isSuspended) {
    return <Navigate to="/support" replace />
  }

  if (!hasActiveEnrollment) {
    return <Navigate to="/complete-enrollment" replace />
  }

  return <Outlet />
}
