import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, FolderKanban, IndianRupee, BarChart3, Megaphone, LifeBuoy,
  Settings as SettingsIcon, LogOut, KeyRound, Lock, ShieldAlert, Award, ChevronDown, UserCog, Tags, Mail, ClipboardCheck, Mic, ListChecks, BarChart2, Trophy } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { TIERS } from '../lib/v2'
import { pageAreas } from '../lib/access'

// Every item is also enforced by the API (403 for Instructors); hiding here is presentation only.
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { area: 'students', label: 'Students', icon: Users, children: TIERS.map((t) => ({ to: `/students/${t.key}`, label: t.label })) },
  { area: 'work', label: 'Work Management', icon: FolderKanban, children: TIERS.map((t) => ({ to: `/work/${t.key}`, label: t.label })) },
  { area: 'mcq', label: 'MCQ Results', icon: BarChart2, children: TIERS.filter((t) => ['basic', 'professional'].includes(t.key)).map((t) => ({ to: `/mcq-results/${t.key}`, label: t.label })) },
  { area: 'selections', label: 'Student Selections', icon: ListChecks, children: TIERS.filter((t) => ['basic', 'professional'].includes(t.key)).map((t) => ({ to: `/selections/${t.key}`, label: t.label })) },
  { area: 'evaluation', label: 'Submissions & Evaluation', icon: ClipboardCheck, children: TIERS.map((t) => ({ to: `/evaluate/${t.key}`, label: t.label })) },
  { area: 'mock', label: 'Mock Interviews', icon: Mic, children: TIERS.filter((t) => ['career', 'accelerator'].includes(t.key)).map((t) => ({ to: `/mock-interviews/${t.key}`, label: t.label })) },
  { area: 'eligibility', to: '/eligibility', label: 'Placement Eligibility', icon: Trophy },
  { area: 'programs', to: '/programs', label: 'Programs', icon: GraduationCap },
  { area: 'materials', to: '/materials', label: 'Study Materials', icon: BookOpen },
  { area: 'certificates', to: '/certificates', label: 'Certificates', icon: Award },
  { area: 'payments', to: '/payments', label: 'Payments', icon: IndianRupee, adminOnly: true },
  { area: 'announcements', to: '/announcements', label: 'Announcements', icon: Megaphone },
  { area: 'proctoring', to: '/proctoring', label: 'Proctoring', icon: ShieldAlert },
  { area: 'reports', to: '/reports', label: 'Reports', icon: BarChart3 },
  { area: 'support', to: '/support', label: 'Support', icon: LifeBuoy },
  {
    area: 'settings', label: 'Settings', icon: SettingsIcon, children: [
      { to: '/areas-of-interest', label: 'Areas of Interest', icon: Tags },
      { to: '/instructors', label: 'Instructors', icon: UserCog, adminOnly: true },
      { to: '/email-deliveries', label: 'Email Deliveries', icon: Mail, adminOnly: true },
      { to: '/settings', label: 'System Settings', adminOnly: true },
    ],
  },
  { area: '__super__', to: '/admins', label: 'Admins & Access', icon: KeyRound },
  // Legacy (Premium / Platinum) menu removed: those programmes are closed. Its routes still exist in App.jsx if ever needed.
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`

function Group({ item, isAdmin }) {
  const { pathname } = useLocation()
  const children = item.children.filter((c) => !c.adminOnly || isAdmin)
  const active = children.some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = useState(active)
  if (!children.length) return null
  const Icon = item.icon
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>
        <Icon size={17} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={15} className={`transition-transform ${open || active ? 'rotate-180' : ''}`} />
      </button>
      {(open || active) && (
        <div className="ml-7 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
          {children.map((c) => (
            <NavLink key={c.to} to={c.to} className={({ isActive }) => `block rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout, isAdmin, isSuperAdmin, can } = useAuth()
  const { pathname } = useLocation()
  const need = pageAreas(pathname)
  const blocked = need && !need.some((a) => can(a))
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-sm font-semibold text-brand-700">ARINSA AI MINDS</p>
          <p className="text-xs text-slate-500">{isAdmin ? 'Admin Portal' : 'Instructor Portal'}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.filter((i) => (!i.adminOnly || isAdmin) && (!i.area || can(i.area))).map((item) =>
            item.children ? (
              <Group key={item.label} item={item} isAdmin={isAdmin} />
            ) : (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isAdmin ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
            {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Instructor'}
          </span>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </header>
        <main className="p-6">
          {blocked ? (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Lock className="mx-auto mb-3 text-slate-400" size={32} />
              <h2 className="text-lg font-semibold text-slate-900">No access to this area</h2>
              <p className="mt-1 text-sm text-slate-500">Ask a super admin to grant you access in Admins &amp; Access.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  )
}
