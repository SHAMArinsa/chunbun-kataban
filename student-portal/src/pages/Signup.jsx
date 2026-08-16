import { useEffect, useRef, useState } from 'react'
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
import { NDA_TEXT } from '../content/nda'
import RazorpayPayment from '../components/RazorpayPayment'
import './Signup.css'

const STEPS = ['Plan', 'Account & NDA', 'Payment', 'Done']
const REFUND_CANCELLATION_SECTIONS = [['No-refund policy', 'All program enrollment and registration payments are final and non-refundable, except for a verified duplicate payment caused by a technical or payment-processing issue.'], ['Duplicate payments', 'Only the duplicate or excess transaction may be refunded after ARINSA AI MINDS verifies the participant, program, amount, transaction IDs, payment records and any requested supporting evidence. The original payment remains non-refundable.'], ['Program cancellation', 'A participant may request cancellation of an existing registration, including when they wish to move to another program. Cancellation does not entitle the participant to a refund.'], ['Changing programs', 'A payment from one program is not automatically transferred, credited or adjusted toward another program. A new registration, separate payment and, where required, a different email address may be needed.'], ['Access to digital materials', 'Receiving or not receiving access to learning materials, assessments, projects, datasets or other resources does not change the no-refund policy.'], ['Suspension or termination', 'No refund is provided where access is suspended or terminated for misconduct, impersonation, account sharing, unauthorised distribution of materials, NDA violations, fraud, abuse or security violations.'], ['Career outcomes', 'Enrollment does not guarantee employment, salary, placement, interviews, selection or any particular career outcome.'], ['Verified refund process', 'Approved duplicate-payment refunds ordinarily return through the original payment method. Processing time can depend on the payment gateway, bank, card issuer or UPI provider.'], ['Statutory rights and law', 'Nothing in this policy excludes a refund, remedy or consumer right that ARINSA AI MINDS is legally required to provide. The policy is governed by Indian law, subject to applicable consumer protections and mandatory jurisdictional rights.']]

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
  const [ndaAccepted, setNdaAccepted] = useState(false)
  const [showNdaModal, setShowNdaModal] = useState(false)
  const [ndaRead, setNdaRead] = useState(false)
  const [ndaModalChecked, setNdaModalChecked] = useState(false)
  const [refundAccepted, setRefundAccepted] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundRead, setRefundRead] = useState(false)
  const [refundModalChecked, setRefundModalChecked] = useState(false)
  const ndaContentRef = useRef(null)
  const refundContentRef = useRef(null)
  const ndaAcceptButtonRef = useRef(null)

  const { register: doRegister } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm({ defaultValues: { citizenship_status: 'indian', internship_agreement_accepted: false, refund_accepted: false } })
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

  useEffect(() => {
    if (showNdaModal) ndaAcceptButtonRef.current?.focus()
  }, [showNdaModal])

  const openNdaModal = () => {
    setNdaRead(false)
    setNdaModalChecked(false)
    setShowNdaModal(true)
  }

  const handleNdaScroll = () => {
    const content = ndaContentRef.current
    if (content && content.scrollTop + content.clientHeight >= content.scrollHeight - 2) setNdaRead(true)
  }

  const acceptNda = () => {
    if (!ndaRead || !ndaModalChecked) return
    setNdaAccepted(true)
    setValue('internship_agreement_accepted', true, { shouldValidate: true })
    setShowNdaModal(false)
  }

  const openRefundModal = () => {
    setRefundRead(false)
    setRefundModalChecked(false)
    setShowRefundModal(true)
  }

  const handleRefundScroll = () => {
    const content = refundContentRef.current
    if (content && content.scrollTop + content.clientHeight >= content.scrollHeight - 2) setRefundRead(true)
  }

  const acceptRefund = () => {
    if (!refundRead || !refundModalChecked) return
    setRefundAccepted(true)
    setValue('refund_accepted', true, { shouldValidate: true })
    setShowRefundModal(false)
  }

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
            <div className="signup-agreements"><label><input type="checkbox" {...register('terms_accepted', { required: true })} /> I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link>.</label><label><input type="checkbox" {...register('privacy_accepted', { required: true })} /> I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link>.</label><label><input type="checkbox" {...register('refund_accepted', { required: 'Please read and accept the Refund and Cancellation Policy to continue.' })} checked={refundAccepted} disabled readOnly /> I agree to read the <a href="#refund-policy" onClick={(event) => { event.preventDefault(); openRefundModal() }}>Refund and Cancellation Policy</a>.</label><label><input type="checkbox" {...register('internship_agreement_accepted', { required: 'Please review and accept the NDA to continue.' })} checked={ndaAccepted} disabled readOnly /> I agree to the Internship Agreement and will complete the <a className="nda-read-link" href="#nda" onClick={(event) => { event.preventDefault(); openNdaModal() }}>click here to read the full NDA</a>.</label>{errors.internship_agreement_accepted ? <p>{errors.internship_agreement_accepted.message}</p> : errors.refund_accepted ? <p>{errors.refund_accepted.message}</p> : (errors.terms_accepted || errors.privacy_accepted) && <p>Please accept all agreements to continue.</p>}</div>
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
      {showNdaModal && (
        <div className="nda-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNdaModal(false) }}>
          <section className="nda-modal" role="dialog" aria-modal="true" aria-labelledby="nda-modal-title">
            <div className="nda-modal-header"><h2 id="nda-modal-title">Non-Disclosure Agreement</h2><button ref={ndaAcceptButtonRef} type="button" className="nda-modal-close" onClick={() => setShowNdaModal(false)} aria-label="Close NDA">×</button></div>
            <div className="nda-modal-content" ref={ndaContentRef} onScroll={handleNdaScroll}>{NDA_TEXT}</div>
            <div className="nda-modal-actions"><label><input type="checkbox" checked={ndaModalChecked} disabled={!ndaRead} onChange={(event) => setNdaModalChecked(event.target.checked)} /> I have read and agree to the NDA.</label><button type="button" onClick={acceptNda} disabled={!ndaRead || !ndaModalChecked}>I Agree &amp; Continue</button></div>
          </section>
        </div>
      )}
      {showRefundModal && (
        <div className="nda-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRefundModal(false) }}>
          <section className="nda-modal" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
            <div className="nda-modal-header"><h2 id="refund-modal-title">Refund and Cancellation Policy</h2><button type="button" className="nda-modal-close" onClick={() => setShowRefundModal(false)} aria-label="Close Refund and Cancellation Policy">×</button></div>
            <div className="nda-modal-content" ref={refundContentRef} onScroll={handleRefundScroll}>{REFUND_CANCELLATION_SECTIONS.map(([heading, text], index) => <div className="refund-modal-section" key={heading}><strong>{index + 1}. {heading}</strong><p>{text}</p></div>)}</div>
            <div className="nda-modal-actions"><label><input type="checkbox" checked={refundModalChecked} disabled={!refundRead} onChange={(event) => setRefundModalChecked(event.target.checked)} /> I have read and agree to the Refund and Cancellation Policy.</label><button type="button" onClick={acceptRefund} disabled={!refundRead || !refundModalChecked}>I Agree &amp; Continue</button></div>
          </section>
        </div>
      )}
    </main>
  )
}
