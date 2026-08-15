import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import './SiteChrome.css'

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  return <><div className="site-alert"><b>Discover new high-demand tracks!</b><span>Talk to us at <a href="tel:+919123745946">+91-9123745946</a> · Available 24 hours</span></div><header className="site-header"><Link to="/"><img src="/brand/arinsa-ai-minds-logo.png" alt="ARINSA AI MINDS" /></Link><nav><Link to="/">Home</Link><div className="program-menu"><Link to="/programs">Programs</Link><button aria-label="Open program menu" onClick={() => setOpen(!open)}><ChevronDown /></button>{open && <div className="program-dropdown"><Link to="/programs/basic" onClick={() => setOpen(false)}>Basic Internship</Link><Link to="/programs/professional" onClick={() => setOpen(false)}>Professional Internship</Link><Link to="/programs/premium" onClick={() => setOpen(false)}>Premium Internship</Link><Link to="/programs/platinum" onClick={() => setOpen(false)}>Platinum Program</Link></div>}</div><Link to="/curriculum">Curriculum</Link><Link to="/about">Why ARINSA</Link><Link to="/login">Sign in</Link><Link className="site-cta" to="/signup">Apply now <ArrowRight /></Link></nav></header></>
}
