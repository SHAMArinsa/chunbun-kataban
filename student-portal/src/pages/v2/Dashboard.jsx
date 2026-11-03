import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Award, Bell, CalendarClock, CheckCircle2, Clock, Lock, Mail, Rocket, Sparkles } from 'lucide-react'
import Spinner from '../../components/ui/Spinner'
import { Pill, durationLabel, fmtDate, fmtDateTime, humanize, useV2Overview } from '../../lib/v2'
import '../Dashboard.css'

const NEXT_STEP = {
  basic: [['Study Materials', '/materials'], ['MCQ Assessment', '/quizzes'], ['Select your project', '/project-selection'], ['Submit your project', '/work']],
  professional: [['Study Materials', '/materials'], ['MCQ Assessment', '/quizzes'], ['Select 2 projects', '/project-selection'], ['Submit both projects', '/work']],
  advanced: [['Complete Internship Form & upload resume', '/internship-form'], ['Wait for ARINSA to assign work', '/work'], ['Submit your tasks/projects', '/work']],
  career: [['Complete Internship Form & upload resume', '/internship-form'], ['Submit assigned work', '/work'], ['Attend your Mock Interview', '/mock-interviews']],
  accelerator: [['Videos', '/videos'], ['22 Assignments', '/work?kind=accelerator_assignment'], ['3 Real-World Projects', '/work?kind=real_world_project'], ['Internship', '/internship-form'], ['3 Mock Interviews', '/mock-interviews']],
}

function Card({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Meter({ label, done, total }) {
  const pct = total ? Math.round((100 * done) / total) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{label}</span><b className="text-slate-900">{done} / {total}</b></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function V2Dashboard() {
  const { data, isLoading, error } = useV2Overview()
  if (isLoading) return <Spinner />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error.response?.data?.detail || 'Could not load your dashboard.'}</p>
  if (data.prelaunch) return <PrelaunchDashboard data={data} />
  const { student, enrollment, program, progress } = data
  const tier = program.tier
  const expired = enrollment.access === 'expired'

  return (
    <div className="student-dashboard space-y-6">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-kicker"><Sparkles size={15} /> {program.tier_label.toUpperCase()}</p>
          <h1>Welcome back,<br /><em>{student.name.split(' ')[0]}.</em></h1>
          <p>Student ID <b>{student.student_number}</b> · {durationLabel(program.duration, program.duration_unit)} program</p>
          {data.current_work ? (
            <Link to="/work">Continue: {data.current_work.label} <ArrowRight size={18} /></Link>
          ) : (
            <Link to={NEXT_STEP[tier][0][1]}>{NEXT_STEP[tier][0][0]} <ArrowRight size={18} /></Link>
          )}
        </div>
        <div className="dashboard-progress">
          <span>OVERALL PROGRESS</span>
          <strong>{progress.percent ?? 0}%</strong>
          <p>{progress.track_status === 'completed' ? 'Program requirements completed 🎉' : `${enrollment.days_remaining ?? '—'} days remaining`}</p>
          <div><i style={{ width: `${Math.max(progress.percent || 0, 4)}%` }} /></div>
        </div>
      </section>

      {expired && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>Your program access period ended on <b>{fmtDate(enrollment.end_date)}</b>. You can still view your work and certificates. To continue submitting, please <Link to="/support" className="underline">contact Support</Link> to request an extension.</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Enrolled on', fmtDate(enrollment.enrolled_at)], ['Start date', fmtDate(enrollment.start_date)],
          ['End date', `${fmtDate(enrollment.end_date)}${enrollment.extended ? ' (extended)' : ''}`], ['Program status', <Pill key="s" value={enrollment.access} />],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{k}</p>
            <div className="mt-1 text-base font-semibold text-slate-900">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {tier === 'accelerator' ? (
            <Card title="Program progress" action={progress.stage && <span className="text-xs text-slate-500">Month {progress.stage.month} · {progress.stage.title}</span>}>
              <div className="space-y-4">
                <Meter label="Assignments" done={progress.assignments_completed} total={22} />
                <Meter label="Real-World Projects" done={progress.projects_completed} total={3} />
                <Meter label="Total Required Work" done={progress.total_completed} total={25} />
                <Meter label="Mock Interviews" done={progress.mock_interviews_completed} total={progress.mock_interviews_required} />
                <div className="flex flex-wrap gap-4 pt-1 text-sm">
                  <span>Internship: {progress.internship_form_status === 'not_started' && progress.internship_form_available_on && new Date(progress.internship_form_available_on) > new Date()
                    ? <>form opens <b>{fmtDate(progress.internship_form_available_on)}</b></> : <Pill value={progress.internship_form_status} />}</span>
                  <span>Placement eligibility: <Pill value={progress.eligibility_status} /></span>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Your journey">
              <ol className="space-y-3">
                {NEXT_STEP[tier].map(([label, to], i) => (
                  <li key={label}>
                    <Link to={to} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:border-brand-200 hover:bg-brand-50">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{i + 1}</span>
                      <span className="flex-1 text-sm font-medium text-slate-800">{label}</span>
                      <ArrowRight size={16} className="text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                {progress.mcq && <span>MCQ: {progress.mcq.attempts ? <><b>{progress.mcq.correct}/{progress.mcq.total}</b> ({progress.mcq.percentage}%) <Pill value={progress.mcq.passed ? 'completed' : 'not_met'} label={progress.mcq.status} /></> : 'Not attempted'}</span>}
                {progress.projects_required && <span>Projects completed: <b>{progress.projects_completed}/{progress.projects_required}</b></span>}
                {progress.form_status && <span>Internship form: <Pill value={progress.form_status} /></span>}
                {progress.assigned != null && <span>Assigned work: <b>{progress.completed}/{progress.assigned}</b> completed</span>}
                {progress.mock_interview_status && <span>Mock interview: <Pill value={progress.mock_interview_status} /></span>}
              </div>
            </Card>
          )}

          {data.current_work && (
            <Card title="Current work">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{data.current_work.label}: {data.current_work.title}</p>
                  <p className="text-xs text-slate-500">Deadline {fmtDate(data.current_work.deadline)}</p>
                </div>
                <Pill value={data.current_work.status_label === 'Revision Required' ? 'revision_requested' : 'in_progress'} label={data.current_work.status_label} />
              </div>
            </Card>
          )}

          {data.career_notice && (
            <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
              <Mail size={18} className="mt-0.5 shrink-0" /> {data.career_notice}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Upcoming deadlines">
            {data.deadlines.length ? (
              <ul className="space-y-3">
                {data.deadlines.map((d, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <CalendarClock size={16} className="mt-0.5 text-slate-400" />
                    <div><p className="font-medium text-slate-800">{d.label}</p><p className="text-xs text-slate-500">{fmtDate(d.deadline)} · {d.status_label}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 size={16} /> Nothing due right now.</p>}
          </Card>
          <Card title="Recent notifications" action={<Link to="/notifications" className="text-xs text-brand-700 hover:underline">All</Link>}>
            {data.notifications.length ? (
              <ul className="space-y-3">
                {data.notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 text-sm">
                    <Bell size={16} className="mt-0.5 text-slate-400" />
                    <div><p className="font-medium text-slate-800">{n.title}</p><p className="line-clamp-2 text-xs text-slate-500">{n.message}</p><p className="text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 text-sm text-slate-500"><Clock size={16} /> No notifications yet.</p>}
          </Card>
          <p className="text-center text-xs text-slate-400">Program: {program.name} · Status {humanize(enrollment.status)}</p>
        </div>
      </div>
    </div>
  )
}


function useCountdown(iso) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(new Date(iso).getTime() - now, 0)
  return { done: ms === 0, d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 }
}

const OPENS_AT_LAUNCH = ['Videos', '22 Assignments', '3 Real-World Projects', 'Internship', 'Mock Interviews', 'Placement Eligibility', 'Notifications']

function PrelaunchDashboard({ data }) {
  const { student, enrollment, program } = data
  const launch = new Date(data.launch_at)
  const launchText = `${launch.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })} at ${launch.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`
  const c = useCountdown(data.launch_at)
  useEffect(() => {
    if (c.done) window.location.reload() // launch moment reached: reload to unlock everything
  }, [c.done])

  return (
    <div className="student-dashboard space-y-6">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-kicker"><Sparkles size={15} /> {program.tier_label.toUpperCase()}</p>
          <h1>Welcome aboard,<br /><em>{student.name.split(' ')[0]}.</em></h1>
          <p>Student ID <b>{student.student_number}</b> · {durationLabel(program.duration, program.duration_unit)} program</p>
          <p className="mt-3 flex items-center gap-2 font-semibold"><Rocket size={18} /> Your Career Accelerator will start on {launchText}.</p>
        </div>
        <div className="dashboard-progress">
          <span>STARTS IN</span>
          <strong>{c.d}d {String(c.h).padStart(2, '0')}h</strong>
          <p>{String(c.m).padStart(2, '0')} min {String(c.s).padStart(2, '0')} sec</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="You're all set">
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> Enrolment confirmed on {fmtDate(enrollment.enrolled_at)}.</li>
            <li className="flex gap-2"><Mail size={17} className="mt-0.5 shrink-0 text-brand-600" /> Your Welcome Certificate and invoice have been emailed to {student.email}. Please check your inbox and spam folder.</li>
            <li className="flex gap-2"><Award size={17} className="mt-0.5 shrink-0 text-brand-600" /> You can download both anytime from <Link to="/certificates" className="font-medium text-brand-700 underline">Certificates &amp; Invoices</Link>.</li>
          </ul>
        </Card>
        <Card title="Unlocks on launch day">
          <p className="mb-3 text-sm text-slate-600">These sections open automatically on {launchText}:</p>
          <div className="flex flex-wrap gap-2">
            {OPENS_AT_LAUNCH.map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"><Lock size={12} /> {x}</span>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Questions before launch? Raise a ticket in <Link to="/support" className="underline">Support</Link>.</p>
        </Card>
      </div>
    </div>
  )
}
