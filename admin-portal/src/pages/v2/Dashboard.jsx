import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Award, BarChart3, BookOpen, Briefcase, CalendarDays, ClipboardCheck, ClipboardList, Code2, CreditCard, FileText,
  FolderKanban, GraduationCap, HelpCircle, LifeBuoy, Mail, Megaphone, Percent, Rocket, Settings2, ShieldCheck, UploadCloud, Users,
} from 'lucide-react'
import apiClient from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import Table from '../../components/ui/Table'
import { Section, Status } from '../../components/v2/Kit'
import { fmtDate, fmtDateTime, money } from '../../lib/v2'
import { useAuth } from '../../context/AuthContext'

const TIER_STYLE = {
  basic: { icon: GraduationCap, short: 'Basic', label: 'Basic Internship', tint: 'bg-emerald-50', ink: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700', foot: 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100', pill: 'bg-emerald-600' },
  professional: { icon: Briefcase, short: 'Professional', label: 'Professional Internship', tint: 'bg-sky-50', ink: 'text-sky-700', chip: 'bg-sky-100 text-sky-700', foot: 'bg-sky-50/70 text-sky-800 hover:bg-sky-100', pill: 'bg-sky-600' },
  advanced: { icon: BarChart3, short: 'Advanced', label: 'Advanced Internship', tint: 'bg-violet-50', ink: 'text-violet-700', chip: 'bg-violet-100 text-violet-700', foot: 'bg-violet-50/70 text-violet-800 hover:bg-violet-100', pill: 'bg-violet-600' },
  career: { icon: Users, short: 'Career', label: 'Career Internship', tint: 'bg-orange-50', ink: 'text-orange-700', chip: 'bg-orange-100 text-orange-700', foot: 'bg-orange-50/70 text-orange-800 hover:bg-orange-100', pill: 'bg-orange-500' },
  accelerator: { icon: Rocket, short: 'Accelerator', label: 'Career Accelerator', tint: 'bg-rose-50', ink: 'text-rose-700', chip: 'bg-rose-100 text-rose-700', foot: 'bg-rose-50/70 text-rose-800 hover:bg-rose-100', pill: 'bg-rose-600' },
}
const TIER_KEYS = Object.keys(TIER_STYLE)
// Which Work Management tab each dashboard tile opens, per tier.
const TAB_FOR = { projects: 'assign', assignments: 'assign', forms: 'assign' }

function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }))
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

function Panel({ icon: Icon, title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={22} /></span>
          <div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function StudentCard({ tier, count }) {
  const t = TIER_STYLE[tier]
  return (
    <Link to={`/students/${tier}`} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3 p-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.tint} ${t.ink}`}><t.icon size={22} /></span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{t.short}</p>
          <p className="text-2xl font-bold leading-tight text-slate-900">{count}</p>
          <p className="text-xs text-slate-500">Students</p>
        </div>
      </div>
      <span className={`mt-auto flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition ${t.foot}`}>View Students <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
    </Link>
  )
}

function WorkTile({ to, icon: Icon, title, value, hint, tone }) {
  return (
    <Link to={to} className={`group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm"><Icon size={21} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-2xl font-bold leading-tight text-slate-900">{value ?? '—'}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5" />
    </Link>
  )
}

function ShortcutTile({ to, icon: Icon, title, text, tone }) {
  return (
    <Link to={to} className={`group flex items-start gap-3 rounded-xl p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm"><Icon size={21} /></span>
      <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{title}</p><p className="text-xs leading-snug text-slate-500">{text}</p></div>
      <ArrowRight size={16} className="mt-1 text-slate-400 transition group-hover:translate-x-0.5" />
    </Link>
  )
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const [workTier, setWorkTier] = useState('basic')
  const { data, isLoading } = useQuery({ queryKey: ['v2', 'dashboard'], queryFn: () => apiClient.get('/v2/staff/dashboard').then((r) => r.data) })
  if (isLoading || !data) return <Spinner />
  const counts = Object.fromEntries(data.students_by_program.map((r) => [r.tier, r.count]))
  const w = data.work_by_tier?.[workTier] || {}
  const tab = (k) => (TAB_FOR[k] ? `/work/${workTier}?tab=${k === 'projects' && workTier === 'accelerator' ? 'projects' : k === 'projects' && ['basic', 'professional'].includes(workTier) ? 'project_questions' : TAB_FOR[k]}` : `/evaluate/${workTier}`)
  const name = user?.full_name || 'Admin'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

  const programTiles = [
    { to: '/programs', icon: ClipboardList, title: 'Programs', text: 'Program details, duration and pricing', tone: 'bg-emerald-50' },
    { to: '/materials', icon: BookOpen, title: 'Study Materials', text: 'Upload and manage learning materials', tone: 'bg-sky-50' },
    isAdmin && { to: '/programs', icon: Percent, title: 'Offers', text: 'Create and manage offer pricing', tone: 'bg-orange-50' },
    { to: '/mcq-results/basic', icon: HelpCircle, title: 'MCQ Score', text: 'Student MCQ results and reports', tone: 'bg-violet-50' },
  ].filter(Boolean)
  const opsTiles = [
    isAdmin && { to: '/payments', icon: CreditCard, title: 'Payments', text: 'Payments, invoices and transactions', tone: 'bg-emerald-50' },
    { to: '/certificates', icon: Award, title: 'Certificates', text: 'Generate and send certificates', tone: 'bg-sky-50' },
    { to: '/support', icon: LifeBuoy, title: 'Support', text: `${data.open_tickets} open ticket${data.open_tickets === 1 ? '' : 's'}`, tone: 'bg-violet-50' },
    isAdmin && { to: '/email-deliveries', icon: Mail, title: 'Email', text: data.failed_deliveries ? `${data.failed_deliveries} failed — retry` : 'Email logs and delivery status', tone: data.failed_deliveries ? 'bg-red-50' : 'bg-rose-50' },
    { to: '/announcements', icon: Megaphone, title: 'Announcements', text: 'Send notifications to students', tone: 'bg-amber-50' },
    { to: '/proctoring', icon: ShieldCheck, title: 'Proctoring', text: 'Monitor proctoring events', tone: 'bg-teal-50' },
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-amber-50 via-white to-sky-100 px-6 py-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-lg text-slate-600">{greeting()},</p>
            <h1 className="text-3xl font-bold tracking-tight text-brand-800">{name}</h1>
            <p className="mt-1 text-brand-700">ARINSA AI MINDS — {isAdmin ? 'Admin' : 'Instructor'} Portal Overview</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur">
            <CalendarDays size={16} className="text-brand-600" /> <span className="font-medium text-slate-800">{name}</span> · {today}
          </div>
        </div>
      </section>

      <Panel icon={Users} title="Students" subtitle={`${data.total_students} students across all programs · ${data.active_students} active`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIER_KEYS.slice(0, 4).map((t) => <StudentCard key={t} tier={t} count={counts[t] ?? 0} />)}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StudentCard tier="accelerator" count={counts.accelerator ?? 0} />
        </div>
      </Panel>

      <Panel icon={FolderKanban} title="Work Management" subtitle="Projects, assignments, submissions, internships and evaluations — separately for each program">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist">
          {TIER_KEYS.map((t) => (
            <button key={t} role="tab" aria-selected={workTier === t} onClick={() => setWorkTier(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${workTier === t ? `${TIER_STYLE[t].pill} text-white shadow-sm` : `${TIER_STYLE[t].chip} hover:brightness-95`}`}>
              {TIER_STYLE[t].short}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WorkTile to={tab('projects')} icon={FileText} title="Projects" value={w.projects} hint={workTier === 'accelerator' ? 'Assignments & projects published' : ['basic', 'professional'].includes(workTier) ? 'Project options published' : 'Projects published'} tone="bg-sky-50/60" />
          <WorkTile to={tab('assignments')} icon={Code2} title="Assignments" value={w.assignments} hint="Assigned work in progress" tone="bg-emerald-50/60" />
          <WorkTile to={tab('submissions')} icon={UploadCloud} title="Submissions" value={w.submissions} hint="Waiting for review" tone="bg-orange-50/60" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {w.forms === null
            ? <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400"><ClipboardCheck size={20} /> Internship forms are not part of {TIER_STYLE[workTier].short}.</div>
            : <WorkTile to={tab('forms')} icon={ClipboardCheck} title="Internships" value={w.forms} hint="Forms to review" tone="bg-violet-50/60" />}
          <WorkTile to={tab('evaluations')} icon={Settings2} title="Evaluations" value={w.evaluations} hint="Active students not yet evaluated" tone="bg-rose-50/60" />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel icon={Settings2} title="Program Management" subtitle="Programs, pricing, materials and MCQ">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{programTiles.map((t) => <ShortcutTile key={t.title} {...t} />)}</div>
        </Panel>
        <Panel icon={ClipboardList} title="Operations" subtitle="Payments, certificates, support and communications">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{opsTiles.map((t) => <ShortcutTile key={t.title} {...t} />)}</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Recent Registrations">
          <Table
            keyField="enrollment_id"
            rows={data.recent_registrations}
            columns={[
              { key: 'name', header: 'Student', render: (r) => <Link className="text-brand-700 hover:underline" to={`/enrollments/${r.enrollment_id}`}>{r.name}</Link> },
              { key: 'tier_label', header: 'Program' },
              { key: 'status', header: 'Status', render: (r) => <Status value={r.access} /> },
              { key: 'enrolled_at', header: 'Registered', render: (r) => fmtDate(r.enrolled_at) },
            ]}
          />
        </Section>
        {isAdmin ? (
          <Section title="Recent Payments" actions={<Link to="/payments" className="text-xs text-brand-700 hover:underline">All payments</Link>}>
            <Table
              keyField="id"
              rows={data.recent_payments}
              columns={[
                { key: 'student', header: 'Student' },
                { key: 'amount', header: 'Amount', render: (r) => money(r.amount, r.currency) },
                { key: 'invoice_number', header: 'Invoice' },
                { key: 'paid_at', header: 'Paid', render: (r) => fmtDateTime(r.paid_at) },
              ]}
            />
          </Section>
        ) : (
          <Section title="Recent Proctoring Violations">
            <Table
              keyField="id"
              rows={data.recent_violations}
              columns={[{ key: 'type', header: 'Violation' }, { key: 'at', header: 'When', render: (r) => fmtDateTime(r.at) }]}
            />
          </Section>
        )}
      </div>
    </div>
  )
}
