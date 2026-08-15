import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Guards routes restricted to super admins (Internship Plans, Payments, Reports & Analytics,
// Settings). A regular admin hitting these directly by URL is bounced to the dashboard.
export default function SuperAdminGate() {
  const { user } = useAuth()
  if (!user?.is_super_admin) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
