import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import ProgramsBrowser from '../components/ProgramsBrowser'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'

const ACTIVE_STATUSES = ['active', 'completed']

export default function CompleteEnrollment() {
  const { user, logout } = useAuth()
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })

  if (isLoading) return <Spinner className="min-h-screen" />

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
        <ProgramsBrowser />
      </main>
    </div>
  )
}
