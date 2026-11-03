import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, BookOpen, Briefcase, CalendarCheck, CheckCircle2, ChevronDown, ClipboardCheck, Hammer, Handshake, Mic, ShieldCheck, Target, Trophy, XCircle } from 'lucide-react'
import './CurriculumPage.css'
import './AboutPage.css'
import './PlacementGuarantee.css'

const JOURNEY = [
  [BookOpen, 'Learn', 'Structured learning from foundations to modern AI.'],
  [Hammer, 'Build', 'Technical assignments and real-world projects.'],
  [Briefcase, 'Intern', 'Internship experience with tasks, deadlines and reviews.'],
  [Mic, 'Prepare', 'Mock interviews and career preparation.'],
  [Trophy, 'Get placed', 'Eligible graduates progress into placement support under the guarantee.*'],
]

const ELIGIBILITY = [
  [ClipboardCheck, 'Complete the required work', 'Finish the programme’s assignments and projects to the expected standard.'],
  [CalendarCheck, 'Meet deadlines', 'Submit work on time throughout the programme.'],
  [Briefcase, 'Complete the internship', 'Carry out your internship responsibilities with commitment.'],
  [Mic, 'Attend every mock interview', 'Take part in all scheduled mock interviews and act on the feedback.'],
  [ShieldCheck, 'Maintain integrity & conduct', 'Original work, honest assessments and professional behaviour at all times.'],
]

const IS = [
  'Part of the 1-year Career Accelerator programme',
  'Earned through consistent effort and completed milestones',
  'Placement support for eligible graduates under the programme terms',
  'Visible progress — your eligibility is tracked in your student portal',
]
const ISNT = [
  'Not included in the Basic, Professional, Advanced or Career Internship',
  'Not automatic on enrolment or payment alone',
  'Not a substitute for the work, practice and preparation required',
]

const FAQS = [
  ['Which programme includes the job guarantee?', 'Only the 1-year Career Accelerator. The Career Internship offers job assistance (resume support, interview practice and opportunities), but not a guarantee.'],
  ['How do I become eligible?', 'By completing the programme’s required work, meeting deadlines, completing the internship, attending all mock interviews and maintaining integrity and professional conduct — as set out in the programme terms.'],
  ['Can I see whether I’m on track?', 'Yes. Career Accelerator students can follow their eligibility progress inside the student portal throughout the programme.'],
  ['Do I need a computer-science degree to qualify?', 'No. Eligibility depends on your work and conduct during the programme, not on your previous degree.'],
  ['Where can I read the full terms?', 'The complete placement-guarantee terms are shared with you before enrolment. Contact us any time if you have questions.'],
]

export default function PlacementGuarantee() {
  return (
    <main className="cu ab pg">
      <section className="cu-hero pg-hero">
        <div>
          <p className="cu-kicker">CAREER ACCELERATOR · JOB GUARANTEE*</p>
          <h1>Learn it. Prove it. <span>Get placed.</span></h1>
          <p className="cu-lead">The Career Accelerator is the only ARINSA programme backed by a <b>placement guarantee*</b>. Complete the journey, meet the eligibility requirements, and we stand behind your next step.</p>
          <div className="cu-actions"><Link className="cu-btn" to="/signup?program=career_accelerator">Start Career Accelerator <ArrowRight /></Link><Link className="cu-btn ghost" to="/programs/career_accelerator">View programme details</Link></div>
        </div>
        <aside className="pg-badge"><Handshake /><b>Placement Guarantee*</b><span>For eligible Career Accelerator graduates</span></aside>
      </section>

      <section className="cu-sec">
        <div className="cu-head center"><p className="cu-label">HOW IT WORKS</p><h2>A guarantee you <span>earn along the way.</span></h2></div>
        <ol className="pg-journey">{JOURNEY.map(([Icon, t, d], i) => <li key={t} className={i === 4 ? 'end' : ''}><span><Icon /></span><h3>{t}</h3><p>{d}</p></li>)}</ol>
      </section>

      <section className="cu-sec cu-soft">
        <div className="cu-head center"><p className="cu-label">ELIGIBILITY</p><h2>What it takes <span>to qualify.</span></h2><p>The guarantee rewards commitment. Eligibility is based on how you engage with the programme — not on your background.</p></div>
        <div className="pg-elig">{ELIGIBILITY.map(([Icon, t, d]) => <article key={t}><span><Icon /></span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div>
        <p className="pg-track"><Target /> Your eligibility progress is tracked in your student portal, so you always know where you stand.</p>
      </section>

      <section className="cu-sec">
        <div className="cu-head center"><p className="cu-label">CLEAR EXPECTATIONS</p><h2>What the guarantee <span>is — and isn’t.</span></h2></div>
        <div className="pg-isnt">
          <article className="is"><h3><CheckCircle2 /> It is</h3><ul>{IS.map((x) => <li key={x}><CheckCircle2 />{x}</li>)}</ul></article>
          <article className="isnt"><h3><XCircle /> It isn’t</h3><ul>{ISNT.map((x) => <li key={x}><XCircle />{x}</li>)}</ul></article>
        </div>
      </section>

      <section className="cu-sec cu-soft">
        <div className="cu-head"><p className="cu-label">FREQUENTLY ASKED QUESTIONS</p><h2>Good to know</h2></div>
        <div className="cu-faq">{FAQS.map(([q, a], i) => <details key={q}><summary><i>0{i + 1}</i>{q}<ChevronDown /></summary><p>{a}</p></details>)}</div>
      </section>

      <section className="cu-final">
        <BadgeCheck />
        <h2>Ready to work for <span>your placement?</span></h2>
        <p className="ab-final-p">One year of learning, building, interning and preparing — with a guarantee for those who complete the journey.</p>
        <div className="cu-actions center"><Link className="cu-btn light" to="/signup?program=career_accelerator">Start Career Accelerator <ArrowRight /></Link><Link className="cu-btn ghost-light" to="/programs/compare?p=career,career_accelerator">Compare with Career Internship <ArrowRight /></Link></div>
        <small>*Placement guarantee is subject to successful completion of the Career Accelerator eligibility requirements and applicable terms.</small>
      </section>
    </main>
  )
}
