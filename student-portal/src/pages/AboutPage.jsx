import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Compass, FileCheck2, Hammer, ListChecks, Rocket, TrendingUp, Wrench } from 'lucide-react'
import './CurriculumPage.css'
import './AboutPage.css'

const PILLARS = [
  [Hammer, 'Learn by doing', 'Knowledge becomes more valuable when you put it to work.', 'Our programmes use practical exercises, assessments, assignments and projects to help you move from understanding a concept to actually applying it.', ['Learn', 'Practise', 'Build']],
  [ListChecks, 'Experience real expectations', 'Good work requires more than finishing a tutorial.', 'Depending on your programme, you encounter structured requirements, deadlines, submissions, reviews and feedback — helping you develop the habits expected in professional environments.', ['Tasks', 'Deadlines', 'Submissions', 'Reviews']],
  [BadgeCheck, 'Build proof of your ability', 'A certificate can say you completed something. Your work should show what you can actually do.', 'Projects, technical assignments, reviewed submissions and verifiable credentials help you build a stronger professional story.', ['Work', 'Feedback', 'Improvement', 'Proof']],
  [Compass, 'Start from where you are', 'There is no single starting point.', 'You might be a college student exploring technology, a graduate preparing for your first job, someone from a non-technical background entering AI, or a working professional changing direction. ARINSA offers five independent programmes so you can choose the commitment that fits your current stage.', null],
  [Rocket, 'Grow beyond the classroom', 'For learners who want to go further.', 'Longer programmes add internship experience, real-world projects, mock interviews and career preparation. The Career Accelerator brings the complete journey together:', ['Learn', 'Build', 'Intern', 'Prepare', 'Pursue placement*']],
]
const DURATIONS = [['Basic', '2 Weeks'], ['Professional', '4 Weeks'], ['Advanced', '12 Weeks'], ['Career', '24 Weeks'], ['Career Accelerator', '1 Year']]
const VALUES = [
  [Wrench, 'Practicality', 'Build things. Solve problems. Apply what you learn.'],
  [TrendingUp, 'Progress', 'Start at your level and keep moving toward greater capability.'],
  [FileCheck2, 'Proof', 'Create work, experience and credentials you can confidently demonstrate.'],
]

export default function AboutPage() {
  return (
    <main className="cu ab">
      <section className="cu-hero ab-hero">
        <p className="cu-kicker">WHY ARINSA</p>
        <h1>Learning should <span>lead somewhere.</span></h1>
        <p className="cu-lead">ARINSA AI MINDS was built around a simple idea: <b>technical education becomes more valuable when you have the opportunity to apply it.</b></p>
        <p className="cu-sub">That’s why our programmes go beyond lessons. Depending on the programme you choose, your journey can include practical assessments, projects, assigned work, structured feedback, internship experience, interview preparation and career support.</p>
        <blockquote className="ab-quote">You don’t just learn what something is.<br /><b>You learn what to do with it.</b></blockquote>
        <div className="cu-actions"><Link className="cu-btn" to="/programs">Explore our programmes <ArrowRight /></Link></div>
      </section>

      <section className="cu-sec">
        <div className="ab-pillars">
          {PILLARS.map(([Icon, title, lead, text, flow], i) => (
            <article key={title} className={i === 4 ? 'flag' : ''}>
              <div className="ab-num"><span><Icon /></span><i>0{i + 1}</i></div>
              <div>
                <h2>{title}</h2>
                <p className="ab-lead">{lead}</p>
                <p>{text}</p>
                {flow && <div className="ab-flow">{flow.map((f, j) => <span key={f}>{j > 0 && <ArrowRight />}<b>{f}</b></span>)}</div>}
                {i === 3 && <div className="ab-durs">{DURATIONS.map(([n, d]) => <Link key={n} to="/programs"><b>{n}</b><small>{d}</small></Link>)}</div>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cu-sec cu-navy ab-approach">
        <p className="cu-label light">OUR APPROACH</p>
        <h2>Different beginnings. <span>One belief in potential.</span></h2>
        <p>You don’t need to come from Computer Science to begin building technical skills.</p>
        <div className="ab-fields">{['Engineering', 'Science', 'Commerce', 'Business', 'Arts', 'Humanities', 'An entirely different field'].map((f) => <span key={f}>{f}</span>)}</div>
        <p className="ab-big">Your academic background may shape where you start — <b>it doesn’t have to decide where you finish.</b></p>
        <p>What matters is your willingness to learn, practise, solve problems and keep progressing.</p>
      </section>

      <section className="cu-sec cu-soft">
        <div className="cu-head center"><p className="cu-label">WHAT WE VALUE</p><h2>Three ideas <span>behind everything we do.</span></h2></div>
        <div className="ab-values">{VALUES.map(([Icon, t, d]) => <article key={t}><span><Icon /></span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </section>

      <section className="cu-final">
        <Compass />
        <h2>Your starting point doesn’t <span>define your destination.</span></h2>
        <p className="ab-final-p">Whether you’re looking for your <b>first practical internship</b> or a <b>complete one-year path into AI and technology</b>, there is an ARINSA programme designed for your next step.</p>
        <div className="cu-actions center"><Link className="cu-btn light" to="/programs">Find your programme <ArrowRight /></Link><Link className="cu-btn ghost-light" to="/apply">Start your application <ArrowRight /></Link></div>
        <small>*Placement guarantee under the Career Accelerator is subject to programme eligibility requirements and applicable terms.</small>
      </section>
    </main>
  )
}
