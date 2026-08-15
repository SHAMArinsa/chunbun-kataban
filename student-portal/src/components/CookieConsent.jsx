import { useState } from 'react'
import { Link } from 'react-router-dom'
import './CookieConsent.css'
export default function CookieConsent(){const[open,setOpen]=useState(()=>localStorage.getItem('arinsa-cookie-choice')!=='accepted');if(!open)return null;const accept=()=>{localStorage.setItem('arinsa-cookie-choice','accepted');setOpen(false)};return <aside className="cookie-consent"><b>Cookies on ARINSA AI MINDS</b><p>We use essential cookies to operate the website and student portal. Read our <Link to="/cookies">Cookie Policy</Link>.</p><button onClick={accept}>Accept cookies</button></aside>}
