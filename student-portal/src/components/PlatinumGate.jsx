import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router-dom'
import apiClient from '../api/client'
import Spinner from './ui/Spinner'

const ACTIVE_STATUSES = ['active', 'completed']

// Guards routes that only make sense for the Platinum program (e.g. Live Classes).
// Students without an active/completed Platinum enrollment are bounced back to the dashboard.
export default function PlatinumGate() {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })

  if (isLoading) return <Spinner className="min-h-screen" />

  const isPlatinum = enrollments?.some((e) => ACTIVE_STATUSES.includes(e.status) && e.program_code === 'platinum')

  if (!isPlatinum) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
