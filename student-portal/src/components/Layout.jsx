import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Code2,
  FolderKanban,
  ListChecks,
  GraduationCap,
  Map,
  Award,
  LifeBuoy,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import './Layout.css'

const ACTIVE_STATUSES = ['active', 'completed']

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/materials', label: 'Learning Materials', icon: BookOpen },
  { to: '/live-classes', label: 'Live Classes', icon: Video, platinumOnly: true },
  { to: '/coding', label: 'Coding Work', icon: Code2 },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/marksheet', label: 'Marksheet', icon: GraduationCap },
  { to: '/timeline', label: 'Timeline', icon: Map },
  { to: '/certificates', label: 'Certificates & Invoices', icon: Award },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })
  const hasActiveEnrollment = enrollments?.some((e) => ACTIVE_STATUSES.includes(e.status))
  const suspendedEnrollment = !hasActiveEnrollment && enrollments?.find((e) => e.status === 'suspended')
  const isSuspended = !!suspendedEnrollment
  const isPlatinum = enrollments?.some((e) => ACTIVE_STATUSES.includes(e.status) && e.program_code === 'platinum')
  const visibleNavItems = isSuspended
    ? NAV_ITEMS.filter((item) => item.to === '/support')
    : NAV_ITEMS.filter((item) => !item.platinumOnly || isPlatinum)

  return (
    <div className="portal-shell flex min-h-screen bg-slate-50">
      <aside className="portal-sidebar flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-sm font-semibold text-brand-700">ARINSA AI MINDS</p>
          <p className="text-xs text-slate-500">Student Portal</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `portal-nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={logout}
            className="portal-nav-link flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
          >
            <LogOut size={17} />
            Logout
          </button>
        </nav>
      </aside>
      <div className="portal-content flex-1">
        <header className="portal-topbar relative flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <NotificationBell />
          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-right hover:bg-slate-50"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700"><User size={18} /></span>
              <span>
                <span className="block text-sm font-medium text-slate-900">{user?.full_name}</span>
                <span className="block text-xs text-slate-500">{user?.email}</span>
              </span>
              <ChevronDown size={15} className="text-slate-400" />
            </button>
            {accountMenuOpen && (
              <div role="menu" className="absolute right-0 z-50 mt-2 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="portal-main p-6">
          {isSuspended && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">Your account has been suspended.</p>
              {suspendedEnrollment.suspension_reason && (
                <p className="mt-1 font-medium">{suspendedEnrollment.suspension_reason}</p>
              )}
              <p className="mt-0.5">You can&apos;t access the student portal right now. Please raise a support ticket below and our team will help you resolve this.</p>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
