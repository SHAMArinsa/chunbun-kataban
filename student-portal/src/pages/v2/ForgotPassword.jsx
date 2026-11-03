import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { errorText } from '../../lib/v2'

export default function ForgotPassword() {
  const { push } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ email: '', code: '', new_password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const run = async (fn) => { setBusy(true); try { await fn() } catch (e) { push(errorText(e), 'error') } finally { setBusy(false) } }
  const request = () => run(async () => { await apiClient.post('/auth/password/forgot', { email: f.email }); push('If this email is registered, a reset code has been sent.', 'success'); setStep(1) })
  const reset = () => run(async () => {
    if (f.new_password !== f.confirm) throw new Error('Passwords do not match')
    await apiClient.post('/auth/password/reset', { email: f.email, code: f.code, new_password: f.new_password })
    push('Password updated. Please sign in.', 'success'); navigate('/login')
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
        {step === 0 ? (
          <>
            <p className="text-sm text-slate-500">Enter your registered email. We’ll send a 6-digit code.</p>
            <Input label="Email" type="email" value={f.email} onChange={set('email')} />
            <Button className="w-full" disabled={busy || !f.email} onClick={request}>Send reset code</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">Enter the code sent to <b>{f.email}</b> and choose a new password.</p>
            <Input label="6-digit code" value={f.code} maxLength={6} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '') })} />
            <Input label="New password (min 8 characters)" type="password" value={f.new_password} onChange={set('new_password')} />
            <Input label="Confirm new password" type="password" value={f.confirm} onChange={set('confirm')} />
            <Button className="w-full" disabled={busy || f.code.length !== 6 || f.new_password.length < 8} onClick={reset}>Update password</Button>
            <button className="w-full text-xs text-slate-500 hover:underline" onClick={request} disabled={busy}>Resend code</button>
          </>
        )}
        <Link to="/login" className="block text-center text-sm text-brand-700 hover:underline">Back to sign in</Link>
      </div>
    </div>
  )
}
