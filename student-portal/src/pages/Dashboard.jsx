import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import { ArrowRight, Award, ClipboardCheck, Clock, GraduationCap, Sparkles } from 'lucide-react'
import BasicGuide from './BasicGuide'
import ProfessionalGuide from './ProfessionalGuide'
import PremiumGuide from './PremiumGuide'
import PlatinumGuide from './PlatinumGuide'
import './Dashboard.css'
const programmeNames = { 1: 'Basic Internship', 2: 'Professional Internship', 3: 'Premium Internship', 4: 'Platinum Program' }
function StatCard({ icon: Icon, label, value }) { return <article className="dashboard-stat"><span><Icon size={20} /></span><div><p>{label}</p><strong>{value}</strong></div></article> }
export default function Dashboard() {
  const { data: enrollments, isLoading } = useQuery({ queryKey: ['enrollments', 'me'], queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data) })
  const { data: attempts } = useQuery({ queryKey: ['quiz-attempts', 'me'], queryFn: () => apiClient.get('/quizzes/attempts/me').then((r) => r.data) })
  const { data: certificates } = useQuery({ queryKey: ['certificates'], queryFn: () => apiClient.get('/certificates').then((r) => r.data) })
  if (isLoading) return <Spinner />
  const activeEnrollment = enrollments?.find((e) => e.status === 'active')
  const isBasic = activeEnrollment?.program_code === 'basic' || activeEnrollment?.program_id === 1
  const isProfessional = activeEnrollment?.program_code === 'professional' || activeEnrollment?.program_id === 2
  const isPremium = activeEnrollment?.program_code === 'premium' || activeEnrollment?.program_id === 3
  const isPlatinum = activeEnrollment?.program_code === 'platinum' || activeEnrollment?.program_id === 4
  const summary = isPlatinum ? 'Follow a 24-week journey of structured technical learning, industry experience, and career preparation.' : isPremium ? 'Take on advanced software and AI development challenges through practical projects, reviews, and assessments.' : isProfessional ? 'Strengthen practical development skills through assessments and an end-to-end application.' : isBasic ? 'Build a programming foundation through practical work, assessments, and a real software project.' : 'Keep building your skills through practical work, assessments, and meaningful project experience.'
  return <div className="student-dashboard"><section className="dashboard-hero"><div><p className="dashboard-kicker"><Sparkles size={15} /> ARINSA STUDENT PORTAL</p><h1>Welcome back,<br /><em>Student.</em></h1><p>{summary}</p><a href="/materials">Continue learning <ArrowRight size={18} /></a></div><div className="dashboard-progress"><span>YOUR JOURNEY</span><strong>{activeEnrollment ? `Week ${activeEnrollment.current_week || 1}` : 'Ready to begin'}</strong><p>{activeEnrollment ? 'Stay consistent—your next milestone is waiting.' : 'Choose a programme to begin your journey.'}</p><div><i style={{ width: activeEnrollment ? `${Math.min((activeEnrollment.current_week || 1) * 10, 100)}%` : '8%' }} /></div></div></section><section className="dashboard-stats"><StatCard icon={GraduationCap} label="Enrollments" value={enrollments?.length ?? 0} /><StatCard icon={ClipboardCheck} label="Quizzes passed" value={attempts?.filter((a) => a.passed).length ?? 0} /><StatCard icon={Award} label="Certificates" value={certificates?.length ?? 0} /><StatCard icon={Clock} label="Current week" value={activeEnrollment?.current_week ?? '—'} /></section>{isBasic && <BasicGuide />}{isProfessional && <ProfessionalGuide />}{isPremium && <PremiumGuide />}{isPlatinum && <PlatinumGuide />}<section className="dashboard-enrollments"><div className="dashboard-section-title"><div><p>YOUR PROGRAMMES</p><h2>Learning workspace</h2></div><a href="/materials">View materials <ArrowRight size={16} /></a></div>{enrollments?.length ? <div className="dashboard-enrollment-list">{enrollments.map((e) => <article key={e.id}><div><span>PROGRAMME</span><h3>{e.program_name || programmeNames[e.program_id] || `Program #${e.program_id}`}</h3><p>Enrolled {new Date(e.enrolled_at).toLocaleDateString()}</p></div><div className="dashboard-enrollment-status"><Badge color={e.status === 'active' ? 'green' : e.status === 'pending_payment' ? 'yellow' : 'slate'}>{e.status.replace('_', ' ')}</Badge><a href="/timeline" aria-label="Open programme"><ArrowRight size={19} /></a></div></article>)}</div> : <div className="dashboard-empty"><GraduationCap size={24} /><h3>Your workspace is waiting.</h3><p>Choose an internship programme to unlock your learning journey.</p><a href="/signup">Explore programmes <ArrowRight size={17} /></a></div>}</section></div>
}
