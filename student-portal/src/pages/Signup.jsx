import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Check } from 'lucide-react'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import FileUpload from '../components/ui/FileUpload'
import NdaAgreement from '../components/NdaAgreement'
import RazorpayPayment from '../components/RazorpayPayment'
import './Signup.css'

const STEPS = ['Plan', 'Account & NDA', 'Payment', 'Done']

function StepHeader({ current }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              i < current ? 'bg-emerald-500 text-white' : i === current ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {i < current ? <Check size={14} /> : i + 1}
          </div>
          <span className={`text-xs ${i === current ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{label}</span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-8 bg-slate-200" />}
        </div>
      ))}
    </div>
  )
}

export default function Signup() {
  const [step, setStep] = useState(0)
  const [programs, setPrograms] = useState(null)
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [payment, setPayment] = useState(null)
  const [accountForm, setAccountForm] = useState(null)
  const [idDocumentFront, setIdDocumentFront] = useState(null)
  const [idDocumentBack, setIdDocumentBack] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [paidReceipt, setPaidReceipt] = useState(null)

  const [verifiedEmail, setVerifiedEmail] = useState(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  const { register: doRegister } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors }, watch } = useForm({ defaultValues: { citizenship_status: 'indian' } })
  const emailValue = watch('email')
  const isEmailVerified = !!verifiedEmail && verifiedEmail === emailValue

  const handleSendOtp = async () => {
    if (!emailValue) {
      push('Enter your email first', 'error')
      return
    }
    setSendingOtp(true)
    try {
      await apiClient.post('/auth/otp/send', { email: emailValue })
      setOtpSent(true)
      push('Verification code sent to your email.', 'success')
    } catch (err) {
      push(err.response?.data?.detail || 'Could not send verification code', 'error')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      push('Enter the 6-digit code', 'error')
      return
    }
    setVerifyingOtp(true)
    try {
      await apiClient.post('/auth/otp/verify', { email: emailValue, code: otpCode })
      setVerifiedEmail(emailValue)
      push('Email verified!', 'success')
    } catch (err) {
      push(err.response?.data?.detail || 'Verification failed', 'error')
    } finally {
      setVerifyingOtp(false)
    }
  }

  useEffect(() => {
    apiClient.get('/public/programs').then((r) => setPrograms(r.data))
  }, [])

  const handlePlanContinue = () => {
    if (!selectedProgram) {
      push('Please select a plan to continue', 'error')
      return
    }
    setStep(1)
  }

  const handleAccountSubmit = async (values) => {
    if (verifiedEmail !== values.email) {
      push('Please verify your email before continuing', 'error')
      return
    }
    if (!idDocumentFront || !idDocumentBack) {
      push('Please upload both the front and back of your ID document', 'error')
      return
    }
    setAccountForm(values)
    setStep(1.5) // show NDA within same step
  }

  const handleNdaAccept = async (signatureName) => {
    setSubmitting(true)
    try {
      await doRegister(accountForm)
      // Uploading the ID document requires an authenticated session, which only exists once
      // registration above has succeeded — it can't happen earlier in the flow. Best-effort: a
      // failed upload here shouldn't block the rest of signup, since the student can still add
      // it later from their profile.
      for (const [side, file] of [['front', idDocumentFront], ['back', idDocumentBack]]) {
        try {
          const fd = new FormData()
          fd.append('file', file)
          await apiClient.post(`/students/me/national-id-document/${side}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        } catch {
          push(`Account created, but the ID document (${side}) upload failed — you can add it later from your profile.`, 'error')
        }
      }
      const { data: newEnrollment } = await apiClient.post('/enrollments', { program_id: selectedProgram.id })
      await apiClient.post('/nda/accept', { enrollment_id: newEnrollment.id, signature_name: signatureName })
      const { data: payments } = await apiClient.get('/payments/me')
      const matchingPayment = payments.find((p) => p.enrollment_id === newEnrollment.id)
      setEnrollment(newEnrollment)
      setPayment(matchingPayment)
      setStep(2)
    } catch (err) {
      push(err.response?.data?.detail || 'Could not complete signup', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentSuccess = (paidPayment) => {
    setPaidReceipt(paidPayment)
    setStep(3)
  }

  return (
    <main className="signup-page">
      <aside className="signup-intro"><div><p>INTERNSHIP ENROLLMENT</p><h1>Build the work<br /><em>that begins you.</em></h1><p className="signup-intro-copy">Choose the programme that fits your next step. Learn, build, get reviewed, and leave with work that shows what you can do.</p><ul><li><Check size={18} />Structured learning and assessment</li><li><Check size={18} />Real-world project experience</li><li><Check size={18} />Mentor review and certification</li></ul></div><small>ARINSA AI MINDS · INTELLIGENT SOLUTIONS. REAL IMPACT.</small></aside>
      <div className="arinsa-signup flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="signup-card w-full max-w-2xl p-8">
        <h1 className="mb-1 text-center text-lg font-semibold text-slate-900">Build your career with intention.</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Choose your program and complete your enrollment.</p>
        <StepHeader current={Math.floor(step)} />

        {step === 0 && (
          <div className="space-y-4">
            {!programs ? (
              <Spinner />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProgram(p)}
                    className={`signup-plan rounded-xl border p-4 text-left transition-colors ${
                      selectedProgram?.id === p.id ? 'is-selected border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.duration_weeks} weeks</p>
                    {selectedProgram?.id === p.id && <span className="signup-plan-selected"><Check size={14} /> Selected</span>}
                    <p className="mt-2 text-lg font-bold text-brand-700">₹{p.price_inr} <span className="text-xs font-normal text-slate-400">/ ${p.price_usd}</span></p>
                  </button>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={handlePlanContinue}>Continue</Button>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSubmit(handleAccountSubmit)} className="space-y-4">
            <p className="text-sm text-slate-600">Selected plan: <span className="font-medium text-slate-900">{selectedProgram?.name}</span></p>
            <Input label="Full Name" {...register('full_name', { required: 'Required' })} error={errors.full_name?.message} />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Email"
                  type="email"
                  disabled={isEmailVerified}
                  {...register('email', { required: 'Required' })}
                  error={errors.email?.message}
                />
              </div>
              {isEmailVerified ? (
                <span className="mb-1 flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  <Check size={14} /> Verified
                </span>
              ) : (
                <Button type="button" variant="secondary" onClick={handleSendOtp} disabled={sendingOtp || !emailValue}>
                  {sendingOtp ? 'Sending…' : otpSent ? 'Resend Code' : 'Send Code'}
                </Button>
              )}
            </div>

            {otpSent && !isEmailVerified && (
              <div className="flex items-end gap-2 rounded-lg bg-slate-50 p-3">
                <div className="flex-1">
                  <Input
                    label="Enter 6-digit code"
                    value={otpCode}
                    maxLength={6}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                  />
                </div>
                <Button type="button" onClick={handleVerifyOtp} disabled={verifyingOtp || otpCode.length !== 6}>
                  {verifyingOtp ? 'Verifying…' : 'Verify'}
                </Button>
              </div>
            )}

            <Input label="Phone Number" type="tel" {...register('phone', { required: 'Required' })} error={errors.phone?.message} />
            <Input label="Password" type="password" {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} error={errors.password?.message} />
            <Select label="Citizenship" {...register('citizenship_status')}>
              <option value="indian">Indian</option>
              <option value="international">International</option>
            </Select>
            <Input label="Country" {...register('country')} />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="National ID Type"
                {...register('national_id_type', { required: 'Required' })}
                error={errors.national_id_type?.message}
                placeholder="e.g. PAN, Aadhar, Passport"
              />
              <Input
                label="National ID Number"
                {...register('national_id_number', { required: 'Required' })}
                error={errors.national_id_number?.message}
                placeholder="e.g. ABCDE1234F"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FileUpload
                label="Upload ID Document (Front Side)"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={setIdDocumentFront}
                fileName={idDocumentFront?.name}
                hint="PDF, JPG, JPEG, or PNG"
              />
              <FileUpload
                label="Upload ID Document (Back Side)"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={setIdDocumentBack}
                fileName={idDocumentBack?.name}
                hint="PDF, JPG, JPEG, or PNG"
              />
            </div>
            <div className="signup-agreements"><label><input type="checkbox" {...register('terms_accepted', { required: true })} /> I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link>.</label><label><input type="checkbox" {...register('privacy_accepted', { required: true })} /> I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link>.</label><label><input type="checkbox" {...register('refund_accepted', { required: true })} /> I agree to the <Link to="/refund-cancellation-policy" target="_blank">Refund and Cancellation Policy</Link>.</label><label><input type="checkbox" {...register('internship_agreement_accepted', { required: true })} /> I agree to the Internship Agreement and will complete the <Link to="/nda" target="_blank">NDA</Link>.</label>{(errors.terms_accepted || errors.privacy_accepted || errors.refund_accepted || errors.internship_agreement_accepted) && <p>Please accept all agreements to continue.</p>}</div>
            <Button type="submit" className="w-full" disabled={!isEmailVerified}>Continue to NDA</Button>
            {!isEmailVerified && <p className="text-center text-xs text-amber-600">Please verify your email above before continuing.</p>}
            <button type="button" onClick={() => setStep(0)} className="w-full text-center text-xs text-slate-400 hover:text-slate-600">Back to plan selection</button>
          </form>
        )}

        {step === 1.5 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Almost there — please review and sign the NDA to continue.</p>
            <NdaAgreement fullName={accountForm?.full_name} onAccept={handleNdaAccept} submitting={submitting} />
          </div>
        )}

        {step === 2 && payment && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{selectedProgram?.name}</p>
              <p className="text-slate-500">Amount due: {payment.currency} {payment.total_amount} (incl. {payment.fee_type === 'gst' ? 'GST' : 'platform fee'})</p>
            </div>
            <RazorpayPayment
              paymentId={payment.id}
              studentName={accountForm?.full_name}
              studentEmail={accountForm?.email}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={28} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">You're enrolled!</h2>
            <div className="mx-auto max-w-sm space-y-1 rounded-lg bg-slate-50 p-4 text-left text-sm">
              <p><span className="text-slate-500">Program:</span> {selectedProgram?.name}</p>
              <p><span className="text-slate-500">Amount paid:</span> {paidReceipt?.currency} {paidReceipt?.total_amount}</p>
              <p><span className="text-slate-500">Payment ID:</span> {paidReceipt?.razorpay_payment_id}</p>
              <p><span className="text-slate-500">Status:</span> Active</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </div>
        )}

        {step === 0 && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
          </p>
        )}
      </Card>
      </div>
    </main>
  )
}
