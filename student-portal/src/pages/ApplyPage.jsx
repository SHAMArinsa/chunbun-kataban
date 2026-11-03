import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, CheckCircle2, Clock, Scale } from 'lucide-react'
import apiClient from '../api/client'
import { PROGRAM_GUIDE } from '../content/programDetails'
import { hasActiveOffer } from '../utils/programOffers'
import './ApplyPage.css'

const HIGHLIGHTS = {
  basic: ['Start from the fundamentals', 'Guided learning & practice', 'Your first real project'],
  professional: ['Bigger, industry-style project', 'Professional reviews', 'Completion certificates'],
  advanced: ['Real assigned internship work', 'Matched to your interest area', 'Reviewer feedback'],
  career: ['Assigned tasks & projects', 'Mock interview with feedback', 'Job assistance'],
  career_accelerator: ['Course + internship + career prep', 'Mock interviews', 'Placement guarantee*'],
}
const inr = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const usd = (v) => `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export default function ApplyPage() {
  const navigate = useNavigate()
  const [pick, setPick] = useState('')
  const { data: programs } = useQuery({
    queryKey: ['public-programs'],
    queryFn: () => apiClient.get('/public/programs').then((r) => r.data),
    retry: 1,
  })
  const byCode = Object.fromEntries((programs || []).map((p) => [p.code, p]))
  const chosen = PROGRAM_GUIDE.find(([, c]) => c === pick)

  return (
    <main className="ap">
      <section className="ap-hero">
        <p className="ap-step">STEP 1 OF 2 · CHOOSE YOUR PROGRAMME</p>
        <h1>Which programme do you <span>want to apply for?</span></h1>
        <p>Each programme is independent and complete on its own. Select the one that fits your time, experience and goals — you’ll create your account next.</p>
      </section>

      <section className="ap-list" role="radiogroup" aria-label="Programmes">
        {PROGRAM_GUIDE.map(([fit, code, name, dur]) => {
          const p = byCode[code]
          const offer = p && hasActiveOffer(p)
          const on = pick === code
          return (
            <button key={code} type="button" role="radio" aria-checked={on} className={`ap-card ${on ? 'on' : ''} ${code === 'career_accelerator' ? 'flag' : ''}`} onClick={() => setPick(code)}>
              <span className="ap-radio">{on && <Check />}</span>
              <div className="ap-main">
                <div className="ap-top"><h2>{name}</h2><span className="ap-dur"><Clock /> {dur}</span>{code === 'career_accelerator' && <span className="ap-tag">Placement guarantee*</span>}</div>
                <p className="ap-fit">“{fit}”</p>
                <ul>{HIGHLIGHTS[code].map((h) => <li key={h}><CheckCircle2 />{h}</li>)}</ul>
              </div>
              <div className="ap-price">
                {p ? (offer
                  ? <><del>{inr(p.price_inr)}</del><b>{inr(p.offer_price_inr)}</b><small>{usd(p.offer_price_usd)}</small></>
                  : <><b>{inr(p.price_inr)}</b><small>{usd(p.price_usd)}</small></>) : <small>&nbsp;</small>}
                <Link to={`/programs/${code}`} onClick={(e) => e.stopPropagation()}>Details</Link>
              </div>
            </button>
          )
        })}
      </section>

      <div className="ap-bar">
        <div>{chosen ? <>Selected: <b>{chosen[2]}</b> · {chosen[3]}</> : 'Select a programme to continue'}</div>
        <div className="ap-acts">
          <Link to="/programs/compare" className="ap-ghost"><Scale /> Compare</Link>
          <button type="button" disabled={!pick} onClick={() => navigate(`/signup?program=${pick}`)}>Continue <ArrowRight /></button>
        </div>
      </div>
      <p className="ap-note">Prices exclude GST (India) / processing fee (international). *Placement guarantee applies to the Career Accelerator only, subject to eligibility requirements and programme terms. Already have an account? <Link to="/login">Sign in</Link></p>
    </main>
  )
}
