import { ArrowRight, Check, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import './ProgramsPage.css'

const cards = [
  ['01 / FOUNDATION', 'Basic Internship', '2-Week Foundation Program', '₹3,499 / USD 80', '₹1,999 + GST / USD 55', ['Learn Python, Flask & HTML fundamentals', 'Structured technical learning & hands-on practice', 'Build your first real-world web application', 'Project review with professional feedback', 'Internship & Project Completion Certificates'], '/programs/basic'],
  ['02 / PROFESSIONAL', 'Professional Internship', '4-Week Industry Project Program', '₹7,999 / USD 180', '₹4,999 + GST / USD 125', ['Advanced Python, Flask & PostgreSQL', 'Industry-oriented technical learning', 'Build an end-to-end production-style application', 'Professional project reviews & performance evaluation', 'Internship & Project Completion Certificates'], '/programs/professional'],
  ['03 / CAREER DEVELOPMENT', 'Premium Internship', '6-Week Job Assistance Program', '₹14,999 / USD 380', '₹9,999 + GST / USD 260', ['Advanced AI, Machine Learning & LLMs', 'Real product development experience', 'Work alongside the ARINSA AI MINDS engineering team', 'Resume, GitHub & interview preparation', 'Career guidance with placement assistance'], '/programs/premium'],
  ['04 / FLAGSHIP', 'Platinum Program', '24-Week Placement Guarantee Program', '₹35,000 / USD 900', '₹25,000 + GST / USD 500', ['12 weeks of comprehensive technical training', 'Production-ready capstone application', '12-week real-world industry internship', 'Career mentoring, mock interviews & portfolio development', 'Placement assistance with opportunities at ARINSA AI MINDS*'], '/programs/platinum']
]

function StarRating({ count, className, label }) {
  return <div className={`program-stars ${className}`} aria-label={label}>
    <span className="sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <Star key={index} fill="currentColor" aria-hidden="true" />)}
  </div>
}

export function ProgramCards() {
  return <section className="program-grid">{cards.map(([label, name, tag, regular, offer, items, route], i) => <article className={i === 2 ? 'program-premium' : ''} key={name}>
    {i === 2 && <b className="popular">MOST POPULAR · JOB ASSISTANCE</b>}
    {i === 3 && <b className="program-special">PLACEMENT GUARANTEE</b>}
    <small>{label}</small>
    <h2>{name}</h2>
    {i === 2 && <StarRating count={5} className="program-stars-premium" label="Five stars" />}
    {i === 3 && <StarRating count={10} className="program-stars-platinum" label="Ten stars" />}
    <p>{tag}</p>
    <del>Regular Price: {regular}</del>
    <strong>Limited-Time Offer: {offer}</strong>
    <ul>{items.map(x => <li key={x}><Check />{x}</li>)}</ul>
    <Link to={route}>View Full Programme Details <ArrowRight /></Link>
  </article>)}</section>
}

export default function ProgramsPage() {
  return <main className="programs-page"><section className="program-lead"><p>04 / PROGRAMMES</p><h1>Choose the<br /><em>right stretch.</em></h1><span>Four ways to move with intention.</span></section><ProgramCards /></main>
}
