import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Video,
  ListChecks,
  Code2,
  FolderKanban,
  ClipboardCheck,
  IndianRupee,
  BarChart3,
  Megaphone,
  LifeBuoy,
  Settings as SettingsIcon,
  LogOut,
  Crown,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/programs', label: 'Internship Plans', icon: GraduationCap, superAdminOnly: true },
  { to: '/payments', label: 'Payments', icon: IndianRupee, superAdminOnly: true },
  { to: '/certificates', label: 'Certificates & Invoices', icon: ClipboardCheck },
  { to: '/materials', label: 'Learning Materials', icon: BookOpen },
  { to: '/live-classes', label: 'Live Classes', icon: Video },
  { to: '/quizzes', label: 'Quizzes', icon: ListChecks },
  { to: '/platinum-quizzes', label: 'Platinum Quizzes', icon: Crown },
  { to: '/coding-assignments', label: 'Coding Assignments', icon: Code2 },
  { to: '/platinum-coding-assignments', label: 'Platinum Coding Assignments', icon: Crown },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/platinum-projects', label: 'Platinum Projects', icon: Crown },
  { to: '/evaluations', label: 'Evaluations', icon: ClipboardCheck },
  { to: '/platinum-evaluations', label: 'Platinum Evaluations', icon: Crown },
  { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, superAdminOnly: true },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/proctoring', label: 'Proctoring & Violations', icon: ShieldAlert },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, superAdminOnly: true },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.superAdminOnly || user?.is_super_admin)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-sm font-semibold text-brand-700">ARINSA AI MINDS</p>
          <p className="text-xs text-slate-500">Admin Portal</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
