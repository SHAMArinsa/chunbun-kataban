import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import Spinner from '../components/ui/Spinner'
import { hasActiveOffer, offerExpiryLabel, priceLabel } from '../utils/programOffers'
import './ProgramsPage.css'

const CARD_CONTENT = {
  basic: { label: '01 / FOUNDATION', suffix: 'Foundation Program', items: ['Learn Python, Flask & HTML fundamentals', 'Structured technical learning & hands-on practice', 'Build your first real-world web application', 'Project review with professional feedback', 'Internship & Project Completion Certificates'] },
  professional: { label: '02 / PROFESSIONAL', suffix: 'Industry Project Program', items: ['Advanced Python, Flask & PostgreSQL', 'Industry-oriented technical learning', 'Build an end-to-end production-style application', 'Professional project reviews & performance evaluation', 'Internship & Project Completion Certificates'] },
  premium: { label: '03 / CAREER DEVELOPMENT', suffix: 'Job Assistance Program', items: ['Advanced AI, Machine Learning & LLMs', 'Real product development experience', 'Work alongside the ARINSA AI MINDS engineering team', 'Resume, GitHub & interview preparation', 'Career guidance with placement assistance'] },
  platinum: { label: '04 / FLAGSHIP', suffix: 'Placement Guarantee Program', items: ['12 weeks of comprehensive technical training', 'Production-ready capstone application', '12-week real-world industry internship', 'Career mentoring, mock interviews & portfolio development', 'Placement assistance with opportunities at ARINSA AI MINDS*'] },
}

function StarRating({ count, className, label }) {
  return <div className={`program-stars ${className}`} aria-label={label}>{Array.from({ length: count }, (_, index) => <Star key={index} fill="currentColor" aria-hidden="true" />)}</div>
}

export function ProgramCards() {
  const { data: programs, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-programs'],
    queryFn: () => apiClient.get('/public/programs', { headers: { 'Cache-Control': 'no-cache' } }).then((response) => response.data),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  if (isLoading) return <Spinner />
  if (isError) return <section className="program-grid"><p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Unable to load programme prices. <button className="font-semibold text-blue-700 underline" onClick={() => refetch()}>Try again</button></p></section>
  return <section className="program-grid">{programs?.map((program) => {
    const content = CARD_CONTENT[program.code]
    const offerActive = hasActiveOffer(program)
    if (!content) return null
    return <article key={program.id}>
      {program.code === 'premium' && <b className="popular">MOST POPULAR · JOB ASSISTANCE</b>}
      {program.code === 'platinum' && <b className="program-special">PLACEMENT GUARANTEE</b>}
      <small>{content.label}</small><h2>{program.name}</h2>
      {program.code === 'premium' && <StarRating count={5} className="program-stars-premium" label="Five stars" />}
      {program.code === 'platinum' && <StarRating count={10} className="program-stars-platinum" label="Ten stars" />}
      <p>{program.duration_weeks}-Week {content.suffix}</p>
      {offerActive ? <><del>Regular Price: {priceLabel(program.price_inr, program.price_usd)}</del><strong>Limited-Time Offer: {priceLabel(program.offer_price_inr, program.offer_price_usd, true)}</strong><span className="offer-expiry">{offerExpiryLabel(program)}</span></> : <strong>Price: {priceLabel(program.price_inr, program.price_usd)}</strong>}
      <span className="text-xs text-slate-500">{program.gst_percent}% GST applies at payment</span>
      <ul>{content.items.map((item) => <li key={item}><Check />{item}</li>)}</ul>
      <Link to={`/programs/${program.code}`}>View Full Programme Details <ArrowRight /></Link>
    </article>
  })}</section>
}

export default function ProgramsPage() {
  return <main className="programs-page"><section className="program-lead"><p>04 / PROGRAMMES</p><h1>Choose the<br /><em>right stretch.</em></h1><span>Four ways to move with intention.</span></section><ProgramCards /></main>
}
