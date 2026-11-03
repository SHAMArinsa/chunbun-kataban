import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, HelpCircle, Mail, Phone, Search } from 'lucide-react'
import './CurriculumPage.css'
import './FaqPage.css'

const FAQ = [
  ['Getting started', [
    ['What is ARINSA AI MINDS?', 'ARINSA AI MINDS offers practical internship and career programmes in software development and AI. Instead of only watching lessons, you learn by completing assessments, projects, assigned work and reviews.'],
    ['Who can join?', 'College students, recent graduates, working professionals and career switchers. You can join from any academic background — engineering, science, commerce, business, arts or another field.'],
    ['Do I need a computer-science degree?', 'No. No computer-science or engineering degree is required to begin. Programmes start at a level suited to the participant, and the Basic Internship and Career Accelerator start from the fundamentals.'],
    ['I have never coded before. Where should I start?', 'The Basic Internship is designed for complete beginners. If you want a complete, long-term path into AI, the Career Accelerator also starts with foundations.'],
    ['Can I join while studying or working?', 'Yes. Most work is online and flexible. Longer programmes need consistent daily effort, so plan time each day to meet deadlines.'],
  ]],
  ['Programmes', [
    ['What programmes do you offer?', 'Five programmes: Basic Internship (2 weeks), Professional Internship (4 weeks), Advanced Internship (12 weeks), Career Internship (24 weeks) and the Career Accelerator (1 year).'],
    ['Do I have to complete one programme before joining another?', 'No. Each programme is independent and complete on its own. Choose the one that matches your time, experience and goals.'],
    ['Which programme is right for me?', 'Beginners usually choose Basic; those wanting bigger projects choose Professional; anyone needing real assigned work chooses Advanced; job seekers choose Career Internship; and those wanting a complete path into an AI career choose the Career Accelerator. You can compare them side by side on the Compare Programmes page.'],
    ['Are the programmes online?', 'Yes. You learn, submit work and receive feedback through the ARINSA student portal.'],
    ['Which programmes include an internship?', 'The Advanced Internship, Career Internship and Career Accelerator include assigned work and internship experience. Basic and Professional focus on guided learning and projects.'],
    ['Which programmes include mock interviews?', 'The Career Internship and the Career Accelerator include mock interviews with detailed feedback.'],
  ]],
  ['Job guarantee & career support', [
    ['Which programme has a job guarantee?', 'Only the 1-year Career Accelerator includes a placement guarantee, subject to eligibility requirements and programme terms.'],
    ['How do I become eligible for the guarantee?', 'By completing the required work, meeting deadlines, completing the internship, attending all mock interviews and maintaining integrity and professional conduct. Your eligibility progress is tracked in the student portal.'],
    ['Is a job guaranteed in the Career Internship?', 'No. The Career Internship includes job assistance — resume support, interview practice and job opportunities — but not a guarantee.'],
    ['Is the guarantee automatic after payment?', 'No. The guarantee is earned through completing the programme’s eligibility requirements.'],
  ]],
  ['Fees & payment', [
    ['How much do the programmes cost?', 'Current fees are shown on the Programs page. Indian students pay the listed price plus 18% GST; international students pay the USD price plus a 10% processing fee.'],
    ['How can I pay?', 'You can pay securely online during enrolment. Your invoice is generated automatically once your payment is confirmed.'],
    ['Will I get an invoice?', 'Yes. A payment invoice is issued after payment and is available to download from the Certificates section of your student portal.'],
    ['What is your refund policy?', 'Please see our Refund & Cancellation Policy for full details.'],
  ]],
  ['Certificates & verification', [
    ['What certificates will I receive?', 'You receive a Welcome Certificate when your enrolment is confirmed and a Completion Certificate when you successfully finish your programme.'],
    ['How can an employer verify my certificate?', 'Every Completion Certificate has a unique Credential ID and Credential URL. Anyone can enter the ID on our Verify Certificate page to confirm it is genuine.'],
    ['Where can I download my certificates?', 'In the Certificates section of your student portal. You can view and download them at any time.'],
  ]],
  ['Learning experience', [
    ['How is ARINSA different from a regular online course?', 'You don’t just watch content. Depending on your programme, you complete assessments, build projects, take on assigned tasks with deadlines, receive reviewer feedback and prepare for interviews.'],
    ['Will someone review my work?', 'Yes. Submissions are reviewed and you receive feedback so you can improve.'],
    ['What happens if I need help?', 'You can raise a support ticket from your student portal, or contact us by phone or email. Support is available 24 hours.'],
    ['What do I need to take part?', 'A laptop or computer, a stable internet connection and time each day to learn and complete your work.'],
  ]],
]

export default function FaqPage() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    return FAQ.filter(([c]) => cat === 'All' || c === cat)
      .map(([c, items]) => [c, items.filter(([qq, a]) => !s || qq.toLowerCase().includes(s) || a.toLowerCase().includes(s))])
      .filter(([, items]) => items.length)
  }, [q, cat])
  const count = results.reduce((n, [, i]) => n + i.length, 0)

  return (
    <main className="cu faq">
      <section className="cu-hero faq-hero">
        <p className="cu-kicker"><HelpCircle /> FREQUENTLY ASKED QUESTIONS</p>
        <h1>How can we <span>help you?</span></h1>
        <p className="cu-lead">Answers about our programmes, the job guarantee, fees, certificates and the learning experience.</p>
        <label className="faq-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions — e.g. certificate, refund, beginner" aria-label="Search questions" /></label>
        <div className="faq-cats">{['All', ...FAQ.map(([c]) => c)].map((c) => <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      </section>

      <section className="cu-sec">
        <div className="faq-wrap">
          {count === 0 && <div className="faq-empty"><b>No questions match “{q}”.</b><p>Try another word, or contact us directly — we’re happy to help.</p></div>}
          {results.map(([c, items]) => (
            <div key={c} className="faq-group">
              <h2>{c}</h2>
              <div className="cu-faq">{items.map(([qq, a]) => <details key={qq} open={!!q.trim()}><summary>{qq}<ChevronDown /></summary><p>{a}</p></details>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="cu-sec cu-soft">
        <div className="faq-contact">
          <div><h2>Still have a question?</h2><p>Our team is available 24 hours to help you choose the right programme.</p></div>
          <div className="faq-ways">
            <a href="tel:+919123745946"><Phone /> +91-9123745946</a>
            <a href="mailto:recruitment@arinsaaiminds.com"><Mail /> recruitment@arinsaaiminds.com</a>
            <Link to="/programs/compare">Compare programmes <ArrowRight /></Link>
          </div>
        </div>
        <p className="faq-note">*Placement guarantee applies to the Career Accelerator only and is subject to eligibility requirements and programme terms. <Link to="/job-guarantee">Learn more</Link> · <Link to="/refund-cancellation-policy">Refund policy</Link></p>
      </section>
    </main>
  )
}
