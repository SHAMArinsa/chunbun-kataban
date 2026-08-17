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
import { NDA_TEXT } from '../content/nda'
import RazorpayPayment from '../components/RazorpayPayment'
import { hasActiveOffer } from '../utils/programOffers'
import './Signup.css'

const STEPS = ['Plan', 'Account & NDA', 'Payment', 'Done']
const PROGRAM_LABELS = {
  premium: 'Job Assistance Program',
  platinum: 'Placement Guarantee Program',
}
const offerValidTill = (program) => new Date(`${program.offer_end_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const COUNTRY_CODES = [['+1', 'United States / Canada'], ['+7', 'Russia / Kazakhstan'], ['+20', 'Egypt'], ['+27', 'South Africa'], ['+30', 'Greece'], ['+31', 'Netherlands'], ['+32', 'Belgium'], ['+33', 'France'], ['+34', 'Spain'], ['+36', 'Hungary'], ['+39', 'Italy'], ['+40', 'Romania'], ['+41', 'Switzerland'], ['+43', 'Austria'], ['+44', 'United Kingdom'], ['+45', 'Denmark'], ['+46', 'Sweden'], ['+47', 'Norway'], ['+48', 'Poland'], ['+49', 'Germany'], ['+51', 'Peru'], ['+52', 'Mexico'], ['+53', 'Cuba'], ['+54', 'Argentina'], ['+55', 'Brazil'], ['+56', 'Chile'], ['+57', 'Colombia'], ['+58', 'Venezuela'], ['+60', 'Malaysia'], ['+61', 'Australia'], ['+62', 'Indonesia'], ['+63', 'Philippines'], ['+64', 'New Zealand'], ['+65', 'Singapore'], ['+66', 'Thailand'], ['+81', 'Japan'], ['+82', 'South Korea'], ['+84', 'Vietnam'], ['+86', 'China'], ['+90', 'Turkey'], ['+91', 'India'], ['+92', 'Pakistan'], ['+93', 'Afghanistan'], ['+94', 'Sri Lanka'], ['+95', 'Myanmar'], ['+98', 'Iran'], ['+211', 'South Sudan'], ['+212', 'Morocco'], ['+213', 'Algeria'], ['+216', 'Tunisia'], ['+218', 'Libya'], ['+220', 'Gambia'], ['+221', 'Senegal'], ['+223', 'Mali'], ['+224', 'Guinea'], ['+225', 'Côte d’Ivoire'], ['+226', 'Burkina Faso'], ['+227', 'Niger'], ['+228', 'Togo'], ['+229', 'Benin'], ['+230', 'Mauritius'], ['+231', 'Liberia'], ['+232', 'Sierra Leone'], ['+233', 'Ghana'], ['+234', 'Nigeria'], ['+235', 'Chad'], ['+236', 'Central African Republic'], ['+237', 'Cameroon'], ['+238', 'Cape Verde'], ['+239', 'São Tomé and Príncipe'], ['+240', 'Equatorial Guinea'], ['+241', 'Gabon'], ['+242', 'Congo'], ['+243', 'DR Congo'], ['+244', 'Angola'], ['+245', 'Guinea-Bissau'], ['+246', 'British Indian Ocean Territory'], ['+248', 'Seychelles'], ['+249', 'Sudan'], ['+250', 'Rwanda'], ['+251', 'Ethiopia'], ['+252', 'Somalia'], ['+253', 'Djibouti'], ['+254', 'Kenya'], ['+255', 'Tanzania'], ['+256', 'Uganda'], ['+257', 'Burundi'], ['+258', 'Mozambique'], ['+260', 'Zambia'], ['+261', 'Madagascar'], ['+262', 'Réunion / Mayotte'], ['+263', 'Zimbabwe'], ['+264', 'Namibia'], ['+265', 'Malawi'], ['+266', 'Lesotho'], ['+267', 'Botswana'], ['+268', 'Eswatini'], ['+269', 'Comoros'], ['+290', 'Saint Helena'], ['+291', 'Eritrea'], ['+297', 'Aruba'], ['+298', 'Faroe Islands'], ['+299', 'Greenland'], ['+350', 'Gibraltar'], ['+351', 'Portugal'], ['+352', 'Luxembourg'], ['+353', 'Ireland'], ['+354', 'Iceland'], ['+355', 'Albania'], ['+356', 'Malta'], ['+357', 'Cyprus'], ['+358', 'Finland'], ['+359', 'Bulgaria'], ['+370', 'Lithuania'], ['+371', 'Latvia'], ['+372', 'Estonia'], ['+373', 'Moldova'], ['+374', 'Armenia'], ['+375', 'Belarus'], ['+376', 'Andorra'], ['+377', 'Monaco'], ['+378', 'San Marino'], ['+380', 'Ukraine'], ['+381', 'Serbia'], ['+382', 'Montenegro'], ['+383', 'Kosovo'], ['+385', 'Croatia'], ['+386', 'Slovenia'], ['+387', 'Bosnia and Herzegovina'], ['+389', 'North Macedonia'], ['+420', 'Czechia'], ['+421', 'Slovakia'], ['+423', 'Liechtenstein'], ['+500', 'Falkland Islands'], ['+501', 'Belize'], ['+502', 'Guatemala'], ['+503', 'El Salvador'], ['+504', 'Honduras'], ['+505', 'Nicaragua'], ['+506', 'Costa Rica'], ['+507', 'Panama'], ['+509', 'Haiti'], ['+590', 'Guadeloupe'], ['+591', 'Bolivia'], ['+592', 'Guyana'], ['+593', 'Ecuador'], ['+594', 'French Guiana'], ['+595', 'Paraguay'], ['+596', 'Martinique'], ['+597', 'Suriname'], ['+598', 'Uruguay'], ['+599', 'Caribbean Netherlands'], ['+670', 'Timor-Leste'], ['+672', 'Norfolk Island'], ['+673', 'Brunei'], ['+674', 'Nauru'], ['+675', 'Papua New Guinea'], ['+676', 'Tonga'], ['+677', 'Solomon Islands'], ['+678', 'Vanuatu'], ['+679', 'Fiji'], ['+680', 'Palau'], ['+681', 'Wallis and Futuna'], ['+682', 'Cook Islands'], ['+683', 'Niue'], ['+685', 'Samoa'], ['+686', 'Kiribati'], ['+687', 'New Caledonia'], ['+688', 'Tuvalu'], ['+689', 'French Polynesia'], ['+690', 'Tokelau'], ['+691', 'Micronesia'], ['+692', 'Marshall Islands'], ['+850', 'North Korea'], ['+852', 'Hong Kong'], ['+853', 'Macao'], ['+855', 'Cambodia'], ['+856', 'Laos'], ['+880', 'Bangladesh'], ['+886', 'Taiwan'], ['+960', 'Maldives'], ['+961', 'Lebanon'], ['+962', 'Jordan'], ['+963', 'Syria'], ['+964', 'Iraq'], ['+965', 'Kuwait'], ['+966', 'Saudi Arabia'], ['+967', 'Yemen'], ['+968', 'Oman'], ['+970', 'Palestine'], ['+971', 'United Arab Emirates'], ['+972', 'Israel'], ['+973', 'Bahrain'], ['+974', 'Qatar'], ['+975', 'Bhutan'], ['+976', 'Mongolia'], ['+977', 'Nepal'], ['+992', 'Tajikistan'], ['+993', 'Turkmenistan'], ['+994', 'Azerbaijan'], ['+995', 'Georgia'], ['+996', 'Kyrgyzstan'], ['+998', 'Uzbekistan']]
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
  const [idDocumentError, setIdDocumentError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paidReceipt] = useState(null)

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
  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm({ defaultValues: { citizenship_status: 'indian', country_code: '+91', internship_agreement_accepted: false, refund_accepted: false } })
  const emailValue = watch('email')
  const passwordValue = watch('password')
  const isEmailVerified = !!verifiedEmail && verifiedEmail === emailValue

  const handleSendOtp = async (email) => {
    setSendingOtp(true)
    try {
      await apiClient.post('/auth/otp/send', { email })
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
      push('Email verified. Preparing your payment…', 'success')
      await handleNdaAccept(accountForm.full_name, accountForm)
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
    if (!idDocumentFront || !idDocumentBack) {
      setIdDocumentError(true)
      push('Please upload both the front and back of your ID document', 'error')
      return
    }
    if (!refundAccepted) {
      push('Please read and accept the Refund and Cancellation Policy to continue.', 'error')
      return
    }
    if (!ndaAccepted) {
      push('Please review and accept the NDA to continue.', 'error')
      return
    }
    const { confirm_password: _confirmPassword, country_code, ...registrationValues } = values
    const completedAccountForm = { ...registrationValues, phone: `${country_code}${registrationValues.phone}` }
    setAccountForm(completedAccountForm)
    await handleSendOtp(completedAccountForm.email)
  }

  const handleNdaAccept = async (signatureName, registrationForm = accountForm) => {
    setSubmitting(true)
    try {
      await doRegister(registrationForm)
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

  const handlePaymentSuccess = () => {
    navigate('/dashboard', { replace: true })
  }

  const handlePaymentCancel = async () => {
    try {
      await apiClient.post('/auth/signup/cancel')
    } catch {
      // If checkout was already verified, the backend protects the paid account.
    } finally {
      window.location.assign('/signup')
    }
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
                    <p className="text-sm font-semibold text-slate-900">{p.name}{PROGRAM_LABELS[p.code] && <span className="ml-2 text-xs font-medium text-brand-600">{PROGRAM_LABELS[p.code]}</span>}</p>
                    <p className="text-xs text-slate-500">{p.duration_weeks} weeks</p>
                    {selectedProgram?.id === p.id && <span className="signup-plan-selected"><Check size={14} /> Selected</span>}
                    {hasActiveOffer(p) && <p className="mt-2 text-xs text-slate-400 line-through">₹{p.price_inr} / ${p.price_usd}</p>}
                    <p className="mt-2 text-lg font-bold text-brand-700">₹{hasActiveOffer(p) ? p.offer_price_inr : p.price_inr} <span className="text-xs font-normal text-slate-400">/ ${hasActiveOffer(p) ? p.offer_price_usd : p.price_usd}</span></p>
                    {hasActiveOffer(p) && <p className="text-xs text-slate-500">Offer valid till {offerValidTill(p)}</p>}
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
                  disabled={otpSent || isEmailVerified}
                  {...register('email', { required: 'Required' })}
                  error={errors.email?.message}
                />
              </div>
              {isEmailVerified ? (
                <span className="mb-1 flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  <Check size={14} /> Verified
                </span>
              ) : (
                <span style={{ display: 'none' }}>
                  {sendingOtp ? 'Sending…' : otpSent ? 'Resend Code' : 'Send Code'}
                </span>
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

            <div className="grid grid-cols-3 gap-3"><Select label="Country Code" {...register('country_code', { required: 'Required' })} error={errors.country_code?.message}>{COUNTRY_CODES.map(([code, country]) => <option key={`${code}-${country}`} value={code}>{code} ({country})</option>)}</Select><div className="col-span-2"><Input label="Phone Number" type="tel" {...register('phone', { required: 'Required' })} error={errors.phone?.message} /></div></div>
            <Input label="Password" type="password" {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} error={errors.password?.message} />
            <Input label="Confirm Password" type="password" {...register('confirm_password', { required: 'Required', validate: (value) => value === passwordValue || 'Passwords do not match' })} error={errors.confirm_password?.message} />
            <Select label="Citizenship" {...register('citizenship_status', { required: 'Required' })} error={errors.citizenship_status?.message}>
              <option value="indian">Indian</option>
              <option value="international">International</option>
            </Select>
            <Input label="Country" {...register('country', { required: 'Required' })} error={errors.country?.message} />

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
                label="Upload National ID Document (Front Side)"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(file) => { setIdDocumentFront(file); setIdDocumentError(!file || !idDocumentBack) }}
                fileName={idDocumentFront?.name}
                hint="PDF, JPG, JPEG, or PNG"
                error={idDocumentError && !idDocumentFront ? 'Required' : undefined}
              />
              <FileUpload
                label="Upload National ID Document (Back Side)"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(file) => { setIdDocumentBack(file); setIdDocumentError(!file || !idDocumentFront) }}
                fileName={idDocumentBack?.name}
                hint="PDF, JPG, JPEG, or PNG"
                error={idDocumentError && !idDocumentBack ? 'Required' : undefined}
              />
            </div>
            <div className="signup-agreements"><label><input type="checkbox" {...register('terms_accepted', { required: true })} /> I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link>.</label><label><input type="checkbox" {...register('privacy_accepted', { required: true })} /> I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link>.</label><label><input type="checkbox" {...register('refund_accepted')} checked={refundAccepted} disabled readOnly /> I agree to the <a href="#refund-policy" onClick={(event) => { event.preventDefault(); openRefundModal() }}>click here to read the Refund and Cancellation Policy</a>.</label><label><input type="checkbox" {...register('internship_agreement_accepted')} checked={ndaAccepted} disabled readOnly /> I agree to the Internship Agreement and will complete the <a className="nda-read-link" href="#nda" onClick={(event) => { event.preventDefault(); openNdaModal() }}>click here to read the full NDA</a>.</label>{(errors.terms_accepted || errors.privacy_accepted) && <p>Please accept all agreements to continue.</p>}</div>
            <Button type="submit" className="w-full" disabled={sendingOtp || verifyingOtp || submitting || otpSent}>
              {sendingOtp ? 'Sending verification code…' : 'Continue to NDA'}
            </Button>
            {!otpSent && <p className="text-center text-xs text-slate-500">A verification code will be sent after you continue.</p>}
            {otpSent && !isEmailVerified && <p className="text-center text-xs text-amber-600">Verify the code above to continue to payment.</p>}
            <button type="button" onClick={() => setStep(0)} className="w-full text-center text-xs text-slate-400 hover:text-slate-600">Back to plan selection</button>
          </form>
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
              onCancel={handlePaymentCancel}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={28} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">You're enrolled!</h2>
            <p className="text-sm text-slate-500">Your payment confirmation and invoice have been emailed to you. Redirecting to your dashboard…</p>
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
