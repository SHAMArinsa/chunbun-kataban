import { ArrowRight, ChevronDown, HelpCircle, Clock, Mail, Menu, Phone, UserRound, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import './SiteChrome.css'

const PROGRAMS = [
  ['/programs/basic', 'Basic Internship'],
  ['/programs/professional', 'Professional Internship'],
  ['/programs/advanced', 'Advanced Internship'],
  ['/programs/career', 'Career Internship'],
  ['/programs/career_accelerator', 'Career Accelerator'],
]

export default function SiteHeader() {
  const [menu, setMenu] = useState(false)
  const [drop, setDrop] = useState(false)
  const close = () => { setMenu(false); setDrop(false) }
  return (
    <>
      {/* Slim contact bar */}
      <div className="edu-topbar">
        <div className="edu-topbar-info">
          <a href="tel:+919123745946"><Phone /> +91-9123745946</a>
          <a href="mailto:recruitment@arinsaaiminds.com"><Mail /> recruitment@arinsaaiminds.com</a>
          <span><Clock /> Support available 24 hours</span>
          <Link to="/faq"><HelpCircle /> FAQ</Link>
        </div>
        <Link className="edu-topbar-login" to="/login"><UserRound /> Login / Register</Link>
      </div>

      <header className="edu-header">
        <Link to="/" className="edu-logo" onClick={close}><img src="/brand/arinsa-ai-minds-logo.png" alt="ARINSA AI MINDS" /></Link>
        <nav className={menu ? 'open' : ''}>
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <div className={`edu-drop ${drop ? 'show' : ''}`} onMouseLeave={() => setDrop(false)}>
            <button type="button" onClick={() => setDrop(!drop)} onMouseEnter={() => setDrop(true)}>Programs <ChevronDown /></button>
            <div className="edu-drop-menu">
              <Link to="/programs" onClick={close}>All programs</Link>
              {PROGRAMS.map(([to, name]) => <Link key={to} to={to} onClick={close}>{name}</Link>)}
            </div>
          </div>
          <NavLink to="/curriculum" onClick={close}>Curriculum</NavLink>
          <NavLink to="/about" onClick={close}>Why ARINSA</NavLink>
          <NavLink to="/job-guarantee" onClick={close}>Job Guarantee</NavLink>
          <NavLink to="/verify" onClick={close}>Verify Certificate</NavLink>
          <Link to="/login" className="edu-mobile-only" onClick={close}>Sign in</Link>
        </nav>
        <Link className="edu-cta" to="/apply" onClick={close}>Apply now <ArrowRight /></Link>
        <button type="button" className="edu-burger" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">{menu ? <X /> : <Menu />}</button>
      </header>
    </>
  )
}
