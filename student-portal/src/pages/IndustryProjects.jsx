import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bot, Brain, CheckCircle2, Eye, Layers, LineChart, Sparkles, Wrench, Target, Package, Lightbulb, ListChecks, Workflow, Boxes } from 'lucide-react'
import { INDUSTRY_PROJECTS, projectBySlug } from '../content/industryProjects'
import './Landing.css'

export const PROJECT_ICONS = { Sparkles, LineChart, Layers, Brain, Eye, Bot }

/** Card used on the homepage and the library page. */
export function ProjectCard({ p, index }) {
  const Icon = PROJECT_ICONS[p.icon] || Sparkles
  return (
    <Link className="ipCard" to={`/industry-projects/${p.slug}`}>
      <div className="ipVisual">
        <span className="ipIcon"><Icon /></span>
        <em>{p.category}</em>
        <div className="ipMiniFlow">{p.flow.slice(0, 4).map((f, i) => <span key={f}>{i > 0 && <i />}{f}</span>)}</div>
      </div>
      <div className="ipBody">
        <small>INDUSTRY PROJECT · {String(index + 1).padStart(2, '0')}</small>
        <h3>{p.title}</h3>
        <p>{p.summary}</p>
        <div className="ipStack">{p.stack.slice(0, 5).map((s) => <span key={s}>{s}</span>)}</div>
        <b className="ipLink">Explore project <ArrowRight /></b>
      </div>
    </Link>
  )
}

/** /industry-projects — the full project library. */
export function IndustryProjectsLibrary() {
  return (
    <main className="ipPage">
      <section className="ipHero">
        <p className="eduKicker"><i /> PROJECT LIBRARY</p>
        <h1>Industry project briefs. <span>Built around real problems.</span></h1>
        <p>Each brief describes a realistic scenario — the challenge, what to build, how it works, the technology involved and what the finished work demonstrates.</p>
      </section>
      <section className="ipGrid lib">{INDUSTRY_PROJECTS.map((p, i) => <ProjectCard key={p.slug} p={p} index={i} />)}</section>
      <p className="ipDisclaimer">These are practice briefs designed by ARINSA AI MINDS to reflect real industry scenarios. Projects vary by programme.</p>
    </main>
  )
}

/** /industry-projects/:slug — a single case-study page. */
export function IndustryProjectDetail() {
  const { slug } = useParams()
  const p = projectBySlug(slug)
  if (!p) {
    return <main className="ipPage"><section className="ipHero"><h1>Project not found</h1><p><Link to="/industry-projects">Browse all projects →</Link></p></section></main>
  }
  const Icon = PROJECT_ICONS[p.icon] || Sparkles
  const others = INDUSTRY_PROJECTS.filter((x) => x.slug !== p.slug).slice(0, 3)
  const Section = ({ n, icon: I, title, children }) => (
    <section className="ipSec"><div className="ipSecHead"><span><I /></span><small>{n}</small><h2>{title}</h2></div>{children}</section>
  )
  return (
    <main className="ipPage">
      <section className="ipDetailHero">
        <Link to="/industry-projects" className="ipBack"><ArrowLeft /> All projects</Link>
        <div className="ipDetailTop">
          <span className="ipIcon big"><Icon /></span>
          <div>
            <p className="ipTag">INDUSTRY PROJECT BRIEF · {p.area.toUpperCase()}</p>
            <h1>{p.title}</h1>
          </div>
        </div>
        <blockquote>{p.tagline}</blockquote>
        <div className="ipStack big">{p.stack.map((s) => <span key={s}>{s}</span>)}</div>
      </section>

      <div className="ipDetailBody">
        <Section n="01" icon={Target} title="The Challenge"><p>{p.challenge}</p></Section>
        <Section n="02" icon={Package} title="What You’ll Build"><p>{p.build}</p></Section>
        <Section n="03" icon={Workflow} title="How It Works">
          <div className="ipFlow">{p.flow.map((f, i) => <span key={f}>{i > 0 && <ArrowRight />}<b>{f}</b></span>)}</div>
        </Section>
        <Section n="04" icon={Boxes} title="Technology Stack"><div className="ipStack big">{p.stack.map((s) => <span key={s}>{s}</span>)}</div></Section>
        <Section n="05" icon={ListChecks} title="Core Requirements"><ul className="ipList">{p.requirements.map((r) => <li key={r}><CheckCircle2 />{r}</li>)}</ul></Section>
        <Section n="06" icon={Wrench} title="Engineering Challenges"><ul className="ipList warn">{p.engineering.map((r) => <li key={r}><Lightbulb />{r}</li>)}</ul></Section>
        <Section n="07" icon={Package} title="Expected Deliverables"><div className="ipChips">{p.deliverables.map((d) => <span key={d}>{d}</span>)}</div></Section>
        <Section n="08" icon={CheckCircle2} title="What This Demonstrates"><div className="ipChips strong">{p.demonstrates.map((d) => <span key={d}>{d}</span>)}</div></Section>
      </div>

      <section className="ipCta">
        <h2>Interested in building projects like this?</h2>
        <p>ARINSA programmes are built around practical work, structured feedback and projects you can explain with confidence.</p>
        <div className="eduActions"><Link className="eduBtn light" to="/programs">Explore ARINSA programmes <ArrowRight /></Link><Link className="eduBtn ghost" to="/industry-projects">View all projects <ArrowRight /></Link></div>
      </section>

      <section className="ipMore">
        <h3>More project briefs</h3>
        <div className="ipGrid">{others.map((o) => <ProjectCard key={o.slug} p={o} index={INDUSTRY_PROJECTS.indexOf(o)} />)}</div>
        <p className="ipDisclaimer">Practice brief designed by ARINSA AI MINDS to reflect a real industry scenario. Projects vary by programme.</p>
      </section>
    </main>
  )
}
