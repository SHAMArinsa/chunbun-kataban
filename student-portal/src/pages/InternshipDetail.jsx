import { ArrowRight, BookOpen, Briefcase, CheckCircle2, ChevronDown, GraduationCap, Laptop, Clock, Sparkles, Target, UserRound, Palette } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Spinner from '../components/ui/Spinner'
import { PROGRAM_DETAILS } from '../content/programDetails'
import { feeNote, hasActiveOffer, offerExpiryLabel, priceLabel } from '../utils/programOffers'
import './InternshipDetail.css'

const AUDIENCE_ICONS = { students: GraduationCap, pros: Briefcase, noncs: Palette }
const PREREQ_ICONS = [BookOpen, Laptop, Clock]

export default function InternshipDetail({ program }) {
  const { data: programs, isLoading } = useQuery({ queryKey: ['public-programs'], queryFn: () => apiClient.get('/public/programs').then((r) => r.data) })
  if (isLoading) return <Spinner />
  const d = PROGRAM_DETAILS[program]
  const live = programs?.find((item) => item.code === program)
  const offerActive = hasActiveOffer(live)
  const flagship = program === 'career_accelerator'
  const others = Object.entries(PROGRAM_DETAILS).filter(([code]) => code !== program)

  return (
    <main className={`pd ${flagship ? 'pd-flag' : ''}`}>
      {/* Hero */}
      <section className="pd-hero">
        <div className="pd-hero-copy">
          <p className="pd-kicker">{d.kicker}</p>
          <h1>{d.headline[0]}<span>{d.headline[1]}</span></h1>
          <p className="pd-intro">{d.intro}</p>
          {live && <div className="pd-price">
            {offerActive ? <>
              <span className="pd-old"><small>REGULAR PRICE</small>{priceLabel(live.price_inr, live.price_usd)}</span>
              <strong><small>LIMITED-TIME OFFER</small>{priceLabel(live.offer_price_inr, live.offer_price_usd)}<em>{offerExpiryLabel(live)}</em></strong>
            </> : <strong><small>PROGRAMME FEE</small>{priceLabel(live?.price_inr, live?.price_usd)}</strong>}
            <div className="pd-fee">{feeNote(live).split(' | ').map((t) => <span key={t}>{t}</span>)}</div>
          </div>}
          <div className="pd-actions">
            <Link className="pd-btn" to={`/signup?program=${program}`}>Apply for {d.name} <ArrowRight /></Link>
            <Link className="pd-btn ghost" to={`/programs/compare?p=${program}`}>Compare programmes</Link>
          </div>
        </div>
        <aside className="pd-facts">
          <p>{d.name.toUpperCase()}</p>
          {d.facts.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
        </aside>
      </section>

      {/* Who is it for */}
      <section className="pd-sec">
        <div className="pd-head"><p className="pd-label">IS THIS RIGHT FOR YOU?</p><h2>Who this programme is for</h2></div>
        <div className="pd-aud">
          {d.audiences.map(([key, title, text]) => { const Icon = AUDIENCE_ICONS[key]; return <article key={key}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article> })}
        </div>
      </section>

      {/* Before you start */}
      <section className="pd-sec pd-soft">
        <div className="pd-head"><p className="pd-label">BEFORE YOU START</p><h2>What you need</h2></div>
        <div className="pd-pre">{d.prerequisites.map(([t, s], i) => { const Icon = PREREQ_ICONS[i]; return <div key={t}><Icon /><b>{t}</b><span>{s}</span></div> })}</div>
      </section>

      {/* How it works */}
      <section className="pd-sec">
        <div className="pd-head"><p className="pd-label">HOW IT WORKS</p><h2>Your experience, stage by stage</h2></div>
        <ol className={`pd-stages n${d.stages.length}`}>
          {d.stages.map(([t, s], i) => <li key={t}><i>{String(i + 1).padStart(2, '0')}</i><h3>{t}</h3><p>{s}</p></li>)}
        </ol>
      </section>

      {/* Topics + included + outcomes */}
      <section className="pd-sec pd-soft">
        <div className="pd-grid3">
          <article><Sparkles /><h3>What you’ll work with</h3><div className="pd-chips">{d.topics.map((t) => <span key={t}>{t}</span>)}</div></article>
          <article><CheckCircle2 /><h3>What’s included</h3><ul>{d.included.map((x) => <li key={x}><CheckCircle2 />{x}</li>)}</ul></article>
          <article className="pd-out"><Target /><h3>What you leave with</h3><ul>{d.outcomes.map((x) => <li key={x}><CheckCircle2 />{x}</li>)}</ul></article>
        </div>
      </section>

      {/* FAQ */}
      <section className="pd-sec">
        <div className="pd-head"><p className="pd-label">COMMON QUESTIONS</p><h2>Good to know</h2></div>
        <div className="pd-faq">{d.faqs.map(([q, a]) => <details key={q}><summary>{q}<ChevronDown /></summary><p>{a}</p></details>)}</div>
      </section>

      {/* CTA */}
      <section className="pd-cta">
        <UserRound />
        <h2>Ready to start the {d.name}?</h2>
        <p>Apply online in a few minutes. Your Welcome Certificate and invoice are issued as soon as your enrolment is confirmed.</p>
        <div className="pd-actions center"><Link className="pd-btn light" to={`/signup?program=${program}`}>Apply now <ArrowRight /></Link><Link className="pd-btn ghost-light" to={`/programs/compare?p=${program}`}>Compare programmes</Link></div>
        {d.note && <small>{d.note}</small>}
      </section>

      {/* Other programmes */}
      <section className="pd-sec pd-others">
        <h3>Other ARINSA programmes</h3>
        <div>{others.map(([code, o]) => <Link key={code} to={`/programs/${code}`}><b>{o.name}</b><span>{o.facts[0][0]}</span><ArrowRight /></Link>)}</div>
        <p className="pd-indep">Each programme is independent — choose the one that fits your goals.</p>
      </section>
    </main>
  )
}
