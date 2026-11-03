import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  Bell,
  ClipboardList,
  FileText,
  Mic,
  Target,
  Briefcase,
  Trophy, PlayCircle, Lock, Rocket } from 'lucide-react'
import { useV2Overview, useV2Status } from '../lib/v2'
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

// Portal V2: navigation is derived from the backend's tier feature list, so each
// program only shows the sections it actually has (the API enforces the same rules).
function v2NavItems(overview) {
  const f = new Set(overview?.features || [])
  const tier = overview?.program?.tier
  const items = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
  if (tier === 'accelerator') items.push({ to: '/videos', label: 'Videos', icon: PlayCircle })
  else items.push({ to: '/materials', label: 'Study Materials', icon: BookOpen })
  if (f.has('mcq')) items.push({ to: '/quizzes', label: 'MCQ Assessment', icon: ListChecks })
  if (f.has('project_selection')) items.push({ to: '/project-selection', label: 'Project Selection', icon: Target })
  if (f.has('projects')) items.push({ to: '/work', label: 'Project Submission', icon: FolderKanban })
  if (f.has('internship_form')) items.push({ to: '/internship-form', label: 'Internship Form & Resume', icon: FileText })
  if (f.has('assigned_work')) items.push({ to: '/work', label: 'Assigned Tasks / Projects', icon: ClipboardList })
  if (f.has('assignments')) items.push({ to: '/work?kind=accelerator_assignment', label: '22 Assignments', icon: ClipboardList })
  if (f.has('real_world_projects')) items.push({ to: '/work?kind=real_world_project', label: '3 Real-World Projects', icon: FolderKanban })
  if (f.has('internship')) items.push({ to: '/internship-form', label: 'Internship', icon: Briefcase })
  if (f.has('mock_interviews')) items.push({ to: '/mock-interviews', label: 'Mock Interviews', icon: Mic })
  if (f.has('eligibility')) items.push({ to: '/eligibility', label: 'Placement Eligibility', icon: Trophy })
  items.push({ to: '/certificates', label: 'Certificates & Invoices', icon: Award })
  items.push({ to: '/notifications', label: 'Notifications', icon: Bell })
  items.push({ to: '/profile', label: 'Profile', icon: User })
  items.push({ to: '/support', label: 'Support', icon: LifeBuoy })
  return items
}

// Career Accelerator before launch: only these pages are open; everything else shows as locked.
const PRELAUNCH_OPEN = ['/dashboard', '/certificates', '/profile', '/support']
const isPrelaunchOpen = (path) => PRELAUNCH_OPEN.some((p) => path === p || path.startsWith(`${p}/`))
const launchLabel = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' : '9 November 2026, 1:00 pm IST')

function PrelaunchLocked({ launchAt }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Lock size={24} /></span>
      <h1 className="text-lg font-semibold text-slate-900">This section opens at launch</h1>
      <p className="mt-2 text-sm text-slate-600">Your Career Accelerator starts on <b>{launchLabel(launchAt)}</b>. Videos, assignments, projects, internship, mock interviews, placement eligibility and notifications will unlock automatically then.</p>
      <NavLink to="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"><Rocket size={16} /> Back to Dashboard</NavLink>
    </div>
  )
}

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
  const location = useLocation()
  const { data: status } = useV2Status()
  const isV2 = status?.portal === 'v2' && !isSuspended
  const { data: overview } = useV2Overview(isV2 && status?.access !== 'pending_payment')
  const baseItems = isV2 ? v2NavItems(overview) : NAV_ITEMS.filter((item) => !item.platinumOnly || isPlatinum)
  const visibleNavItems = isSuspended ? NAV_ITEMS.filter((item) => item.to === '/support') : baseItems
  const prelaunch = isV2 && !!overview?.prelaunch
  const pageLocked = prelaunch && !isPrelaunchOpen(location.pathname)
  const isItemActive = (to) => {
    const [path, query = ''] = to.split('?')
    return location.pathname === path && location.search.replace(/^\?/, '') === query
  }

  return (
    <div className="portal-shell flex min-h-screen bg-slate-50">
      <aside className="portal-sidebar flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-sm font-semibold text-brand-700">ARINSA AI MINDS</p>
          <p className="text-xs text-slate-500">Student Portal</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {isV2 && overview && (
            <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">{overview.program.tier_label}</p>
              <p className="text-xs text-slate-500">ID {overview.student.student_number}</p>
            </div>
          )}
          {visibleNavItems.map(({ to, label, icon: Icon }) => (prelaunch && !isPrelaunchOpen(to.split('?')[0]) ? (
            <div
              key={`${to}-${label}`}
              title={`Opens on ${launchLabel(overview.launch_at)}`}
              aria-disabled="true"
              className="portal-nav-link flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400"
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              <Lock size={14} />
            </div>
          ) : (
            <NavLink
              key={`${to}-${label}`}
              to={to}
              className={({ isActive }) =>
                `portal-nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  (to.includes('?') ? isItemActive(to) : isActive && !(location.search && visibleNavItems.some((i) => i.to.startsWith(`${to}?`)))) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          )))}
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
          {!prelaunch && <NotificationBell />}
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
          {pageLocked ? <PrelaunchLocked launchAt={overview.launch_at} /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
