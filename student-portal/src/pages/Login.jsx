import { useState } from 'react'
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import './Login.css'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const onSubmit = async (values) => { setSubmitting(true); try { await login(values.email, values.password); navigate('/dashboard') } catch (err) { push(err.response?.data?.detail || 'Login failed', 'error') } finally { setSubmitting(false) } }

  return <main className="arinsa-login">
    <section className="login-intro"><div className="login-copy"><p>STUDENT PORTAL</p><h1>Your work<br /><em>takes shape.</em></h1><p className="login-description">Continue your internship journey, complete assessments, and build a portfolio you are proud to show.</p><ul>{['Access your learning dashboard', 'Track your project progress', 'Keep building with mentor feedback'].map(item => <li key={item}><CheckCircle2 size={18} />{item}</li>)}</ul></div><small>© {new Date().getFullYear()} ARINSA AI MINDS. Intelligent solutions. Real impact.</small></section>
    <section className="login-form-area"><div className="login-card"><div className="login-lock"><LockKeyhole size={20} /></div><p className="login-eyebrow">WELCOME BACK</p><h2>Sign in to your portal</h2><p className="login-subtitle">Enter your account details to continue your ARINSA internship.</p><form onSubmit={handleSubmit(onSubmit)}><Input label="Email address" type="email" placeholder="you@example.com" {...register('email', { required: 'Email is required' })} error={errors.email?.message} /><Input label="Password" type="password" placeholder="Enter your password" {...register('password', { required: 'Password is required' })} error={errors.password?.message} /><Button type="submit" className="login-submit" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={18} /></>}</Button></form><div className="login-divider" /><p className="login-signup">New to ARINSA? <Link to="/signup">Create your account</Link></p><Link to="/" className="login-back">← Back to ARINSA AI MINDS</Link></div></section>
  </main>
}
