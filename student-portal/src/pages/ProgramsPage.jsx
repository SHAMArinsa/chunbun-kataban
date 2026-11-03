import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Briefcase, Check, Clock, GraduationCap, Palette, Scale } from 'lucide-react'
import { PROGRAM_GUIDE } from '../content/programDetails'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import Spinner from '../components/ui/Spinner'
import { feeNote, hasActiveOffer, offerExpiryLabel } from '../utils/programOffers'
import './ProgramsPage.css'

const CARD_CONTENT = {
  basic: { label: '01 / FOUNDATION', suffix: 'Foundation Programme', items: ['Learn Python, Flask & HTML fundamentals', 'Structured technical learning & hands-on practice', 'Build your first real-world web application', 'Project review with professional feedback', 'Internship & Project Completion Certificates'] },
  professional: { label: '02 / PROFESSIONAL', suffix: 'Industry Project Programme', items: ['Advanced Python, Flask & PostgreSQL', 'Industry-oriented technical learning', 'Build an end-to-end production-style application', 'Professional project reviews & performance evaluation', 'Internship & Project Completion Certificates'] },
  premium: { label: '03 / CAREER DEVELOPMENT', suffix: 'Job Assistance Programme', items: ['Advanced AI, Machine Learning & LLMs', 'Real product development experience', 'Work alongside the ARINSA AI MINDS engineering team', 'Resume, GitHub & interview preparation', 'Career guidance with placement assistance'] },
  advanced: { label: '03 / ADVANCED', suffix: 'Assigned-Work Internship', items: ['Internship form, resume & area of interest', 'Tasks and projects assigned by ARINSA AI MINDS', 'Matched to Development, QA, Support, AI/ML, GenAI and more', 'Reviewer feedback on every submission', 'Welcome & completion certificates'] },
  career: { label: '04 / CAREER', suffix: 'Job Assistance Programme', items: ['Everything in Advanced, over 24 weeks', 'ARINSA-assigned tasks & projects', 'One mock interview with detailed feedback', 'Resume building via your registered email', 'Job opportunities & application support by email'] },
  career_accelerator: { label: '05 / FLAGSHIP', suffix: 'Course + Internship + Placement Guarantee*', items: ['Industry-focused learning videos & materials', 'Technical assignments (Python → Agentic AI)', 'Real-world projects', 'Internship from month 6, full-time months 10–12', '3 mock interviews & placement-guarantee eligibility tracker*'] },
  platinum: { label: '04 / FLAGSHIP', suffix: 'Placement Guarantee Program', items: ['12 weeks of comprehensive technical training', 'Production-ready capstone application', '12-week real-world industry internship', 'Career mentoring, mock interviews & portfolio development', 'Placement assistance with opportunities at ARINSA AI MINDS*'] },
}

const inr = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const usd = (v) => `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const TAGS = { career: { text: 'Most popular · Job assistance', cls: 'pc-tag-popular' }, career_accelerator: { text: 'Flagship · Placement guarantee*', cls: 'pc-tag-flagship' } }

export function ProgramCards() {
  const { data: programs, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-programs'],
    queryFn: () => apiClient.get('/public/programs', { headers: { 'Cache-Control': 'no-cache' } }).then((response) => response.data),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  if (isLoading) return <Spinner />
  if (isError) return <section className="program-grid"><p className="pc-error">Unable to load programme prices. <button onClick={() => refetch()}>Try again</button></p></section>
  return <section className="program-grid">{programs?.map((program) => {
    const content = CARD_CONTENT[program.code]
    if (!content) return null
    const offerActive = hasActiveOffer(program)
    const tag = TAGS[program.code]
    const variant = program.code === 'career_accelerator' ? 'pc-dark' : program.code === 'career' ? 'pc-featured' : ''
    return <article key={program.id} className={`pc ${variant}`}>
      {tag && <span className={`pc-tag ${tag.cls}`}>{tag.text}</span>}
      <div className="pc-head">
        <small>{content.label}</small>
        <span className="pc-duration"><Clock aria-hidden="true" />{(() => { const n = program.duration ?? program.duration_weeks; const u = String(program.duration_unit || 'weeks').replace(/s$/, ''); return `${n} ${u.charAt(0).toUpperCase()}${u.slice(1)}${n > 1 ? 's' : ''}` })()}</span>
      </div>
      <h2>{program.name}</h2>
      <p className="pc-sub">{content.suffix}</p>
      <div className="pc-price">
        {offerActive ? <>
          <del>{inr(program.price_inr)} / {usd(program.price_usd)}</del>
          <div><b>{inr(program.offer_price_inr)}</b><span>/ {usd(program.offer_price_usd)}</span></div>
          <em className="offer-expiry">{offerExpiryLabel(program)}</em>
        </> : <div><b>{inr(program.price_inr)}</b><span>/ {usd(program.price_usd)}</span></div>}
        <small className="pc-fee">{feeNote(program).split(' | ').map((t) => <span key={t}>{t}</span>)}</small>
      </div>
      <ul>{content.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
      <div className="pc-actions">
        <Link className="pc-primary" to={`/signup?program=${program.code}`}>Enroll now</Link>
        <Link className="pc-secondary" to={`/programs/${program.code}`}>Details <ArrowRight aria-hidden="true" /></Link>
      </div>
    </article>
  })}</section>
}

export default function ProgramsPage() {
  return <main className="programs-page">
    <section className="program-lead">
      <p>PROGRAMMES</p>
      <h1>Choose the <em>right stretch.</em></h1>
      <span>Five independent programmes — from a 2-week first internship to a 1-year Career Accelerator. Each one is complete on its own. Pick the one that matches your time, experience and goals.</span>
    </section>

    <section className="pg-who">
      {[[GraduationCap, 'College students', 'Gain practical experience, projects and certificates alongside your degree.'],
        [Briefcase, 'Working professionals', 'Build hands-on tech and AI skills to grow in your role or switch careers.'],
        [Palette, 'Any background', 'Commerce, arts, science or engineering — no computer-science degree required to begin.'],
      ].map(([Icon, t, d]) => <article key={t}><span><Icon /></span><div><b>{t}</b><p>{d}</p></div></article>)}
    </section>

    <ProgramCards />
    <div className="pg-compare"><Link to="/programs/compare?p=career,career_accelerator"><Scale /> Compare programmes side by side <ArrowRight /></Link></div>
    <p className="program-note">*Placement guarantee is subject to eligibility and programme terms.</p>

    <section className="pg-guide">
      <div className="pg-guide-head"><p>NOT SURE WHERE TO START?</p><h2>Which programme is right for me?</h2><span>Find the statement that sounds most like you.</span></div>
      <div className="pg-guide-list">
        {PROGRAM_GUIDE.map(([need, code, name, dur]) => (
          <Link key={code} to={`/programs/${code}`} className={code === 'career_accelerator' ? 'flag' : ''}>
            <span className="pg-need">“{need}”</span>
            <span className="pg-pick"><small>{dur}</small><b>{name}</b></span>
            <ArrowRight />
          </Link>
        ))}
      </div>
      <p className="pg-indep">Every programme is independent — you don’t need to complete one before joining another.</p>
    </section>
  </main>
}
