import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Briefcase, CalendarDays, Camera, Check, Copy, Eye, EyeOff, GitBranch, GraduationCap, KeyRound, Link2, Mail,
  MapPin, Phone, ShieldCheck, User,
} from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { durationLabel, errorText, fmtDate, useV2Status } from '../lib/v2'

const FIELDS = ['full_name', 'phone', 'city', 'state', 'country', 'institution', 'degree', 'graduation_year', 'github_url', 'linkedin_url']

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, icon: Icon, error, className = '', ...props }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <span className="relative block">
        {Icon && <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input {...props} className={`w-full rounded-lg border bg-white py-2 text-sm ${Icon ? 'pl-9' : 'pl-3'} pr-3 ${error ? 'border-red-400' : 'border-slate-300'} focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100`} />
      </span>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

function Avatar({ name }) {
  const { push } = useToast()
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const load = () => apiClient.get('/v2/me/profile-photo', { responseType: 'blob' }).then((r) => setUrl(URL.createObjectURL(r.data))).catch(() => setUrl(null))
  useEffect(() => { load() }, [])
  const upload = async (file) => {
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { push('Please choose a JPG or PNG image.', 'error'); return }
    const fd = new FormData(); fd.append('file', file); setBusy(true)
    try { await apiClient.post('/v2/me/profile-photo', fd); push('Photo updated', 'success'); load() } catch (e) { push(errorText(e), 'error') } finally { setBusy(false) }
  }
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return (
    <button type="button" onClick={() => ref.current?.click()} title="Change photo" aria-label="Change profile photo"
      className="group relative -mt-14 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-brand-100 shadow-md">
      {url ? <img src={url} alt="Profile" className="h-full w-full object-cover" />
        : <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-brand-700">{initials}</span>}
      <span className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-[11px] font-medium text-white transition ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <Camera size={18} />{busy ? 'Uploading…' : 'Change'}
      </span>
      <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { e.target.files?.[0] && upload(e.target.files[0]); e.target.value = '' }} />
    </button>
  )
}

function CopyId({ value }) {
  const [done, setDone] = useState(false)
  if (!value) return null
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(String(value)); setDone(true); setTimeout(() => setDone(false), 1500) }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20" title="Copy Student ID">
      ID {value} {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Header({ profile, overview, completion }) {
  const start = overview?.enrollment?.start_date && new Date(overview.enrollment.start_date)
  const end = overview?.enrollment?.end_date && new Date(overview.enrollment.end_date)
  const pct = start && end ? Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100))) : null
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-[#142a43] via-[#19375a] to-[#2b6ab3] px-6 pb-8 pt-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-300 sm:pl-[116px]">My profile</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-[116px]">
          {overview?.program?.name && <span className="rounded-lg bg-sky-300 px-2.5 py-1 text-xs font-bold text-slate-900">{overview.program.name}</span>}
          <CopyId value={overview?.student?.student_number} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-5 px-6 pb-5 pt-3">
        <Avatar name={profile.full_name} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-slate-900">{profile.full_name || 'Your name'}</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-500"><Mail size={14} /> {profile.email || overview?.student?.email}</p>
        </div>
        <div className="w-full min-w-[220px] sm:w-64">
          <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">Profile completeness</span><span className="font-semibold text-brand-700">{completion}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completion}%` }} /></div>
          {completion < 100 && <p className="mt-1 text-[11px] text-slate-500">Fill in the empty fields below to complete your profile.</p>}
        </div>
      </div>
      {overview && (
        <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
          {[['Duration', durationLabel(overview.program.duration, overview.program.duration_unit)], ['Enrolled', fmtDate(overview.enrollment.enrolled_at)],
            ['Start date', fmtDate(overview.enrollment.start_date)], ['End date', fmtDate(overview.enrollment.end_date)]].map(([k, v]) => (
            <div key={k} className="bg-white px-5 py-3">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500"><CalendarDays size={12} /> {k}</p>
              <p className="text-sm font-semibold text-slate-900">{v || '—'}</p>
            </div>
          ))}
        </div>
      )}
      {pct != null && (
        <div className="border-t border-slate-100 px-6 py-3">
          <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Internship progress</span><span className="font-semibold">{pct}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
    </div>
  )
}

function strength(p) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(4, s)
}

function PasswordField({ label, value, onChange, show, error }) {
  return <Field label={label} icon={KeyRound} type={show ? 'text' : 'password'} value={value} onChange={onChange} error={error} autoComplete="new-password" />
}

function PasswordCard() {
  const { push } = useToast()
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const s = strength(f.new_password)
  const mismatch = f.confirm && f.new_password !== f.confirm
  const short = f.new_password && f.new_password.length < 8
  const ok = f.current_password && f.new_password.length >= 8 && f.new_password === f.confirm
  const save = useMutation({
    mutationFn: () => apiClient.post('/auth/password/change', { current_password: f.current_password, new_password: f.new_password }),
    onSuccess: () => { push('Password changed', 'success'); setF({ current_password: '', new_password: '', confirm: '' }) },
    onError: (e) => push(errorText(e), 'error'),
  })
  return (
    <Section icon={ShieldCheck} title="Password & security" hint="Use at least 8 characters. Mixing letters, numbers and symbols makes it stronger.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PasswordField label="Current password" show={show} value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
        <div>
          <PasswordField label="New password" show={show} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} error={short ? 'At least 8 characters' : ''} />
          {f.new_password && !short && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex flex-1 gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded ${i <= s ? ['bg-red-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-600'][s - 1] : 'bg-slate-200'}`} />)}</div>
              <span className="text-[11px] text-slate-500">{['Weak', 'Weak', 'Fair', 'Good', 'Strong'][s]}</span>
            </div>
          )}
        </div>
        <PasswordField label="Confirm new password" show={show} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} error={mismatch ? 'Passwords do not match' : ''} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setShow(!show)} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700">
          {show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? 'Hide passwords' : 'Show passwords'}
        </button>
        <Button disabled={save.isPending || !ok} onClick={() => save.mutate()}>{save.isPending ? 'Updating…' : 'Update password'}</Button>
      </div>
    </Section>
  )
}

const urlOk = (v, host) => !v || new RegExp(`^https?://(www\\.)?${host}/\\S+`, 'i').test(v.trim())

export default function Profile() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { data: status } = useV2Status()
  const { data: profile, isLoading } = useQuery({ queryKey: ['students', 'me'], queryFn: () => apiClient.get('/students/me').then((r) => r.data) })
  const { data: overview } = useQuery({ queryKey: ['v2', 'overview'], enabled: status?.portal === 'v2', queryFn: () => apiClient.get('/v2/me/overview').then((r) => r.data) })
  const { register, handleSubmit, reset, watch, formState: { isDirty } } = useForm()
  const values = watch()

  useEffect(() => { if (profile) reset(Object.fromEntries(FIELDS.map((k) => [k, profile[k] ?? '']))) }, [profile, reset])

  const updateMutation = useMutation({
    mutationFn: (payload) => apiClient.put('/students/me', payload),
    onSuccess: () => { push('Profile updated!', 'success'); queryClient.invalidateQueries({ queryKey: ['students', 'me'] }) },
    onError: (e) => push(errorText(e) || 'Update failed', 'error'),
  })

  if (isLoading || !profile) return <Spinner />

  const errors = {
    full_name: values.full_name !== undefined && !String(values.full_name).trim() ? 'Name is required' : '',
    phone: values.phone && !/^[+\d][\d\s-]{6,}$/.test(values.phone) ? 'Enter a valid phone number' : '',
    graduation_year: values.graduation_year && (values.graduation_year < 1950 || values.graduation_year > 2100) ? 'Enter a valid year' : '',
    github_url: urlOk(values.github_url, 'github\\.com') ? '' : 'e.g. https://github.com/your-name',
    linkedin_url: urlOk(values.linkedin_url, 'linkedin\\.com') ? '' : 'e.g. https://linkedin.com/in/your-name',
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const completion = Math.round((FIELDS.filter((k) => String((values[k] ?? profile[k]) || '').trim()).length / FIELDS.length) * 100)

  const onSubmit = (v) => {
    if (hasErrors) return
    const out = Object.fromEntries(FIELDS.map((k) => [k, typeof v[k] === 'string' ? v[k].trim() || null : v[k]]))
    out.graduation_year = v.graduation_year ? Number(v.graduation_year) : null
    updateMutation.mutate(out)
  }

  return (
    <div className="no-hero mx-auto max-w-5xl space-y-6 pb-24">
      <Header profile={profile} overview={overview} completion={completion} />

      <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section icon={User} title="Personal details" hint="How ARINSA AI MINDS will address and contact you.">
          <div className="space-y-4">
            <Field label="Full name" icon={User} error={errors.full_name} {...register('full_name')} />
            <Field label="Phone" icon={Phone} placeholder="+91 98765 43210" error={errors.phone} {...register('phone')} />
            <Field label="Email" icon={Mail} value={profile.email || overview?.student?.email || ''} readOnly disabled
              className="[&_input]:cursor-not-allowed [&_input]:bg-slate-50 [&_input]:text-slate-500" />
            <p className="-mt-2 text-[11px] text-slate-500">Email can't be changed here — contact Support if needed.</p>
          </div>
        </Section>

        <Section icon={MapPin} title="Location" hint="Your current city helps us with certificates and communication.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City" placeholder="e.g. Kolkata" {...register('city')} />
            <Field label="State" placeholder="e.g. West Bengal" {...register('state')} />
            <Field label="Country" placeholder="e.g. India" className="sm:col-span-2" {...register('country')} />
          </div>
        </Section>

        <Section icon={GraduationCap} title="Education" hint="Your college or university details.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Institution" icon={Briefcase} placeholder="College / University" className="sm:col-span-2" {...register('institution')} />
            <Field label="Degree" placeholder="e.g. B.Tech CSE" {...register('degree')} />
            <Field label="Graduation year" type="number" placeholder="e.g. 2027" error={errors.graduation_year} {...register('graduation_year')} />
          </div>
        </Section>

        <Section icon={Link2} title="Online profiles" hint="Reviewers may look at these when evaluating your work.">
          <div className="space-y-4">
            <Field label="GitHub" icon={GitBranch} placeholder="https://github.com/your-name" error={errors.github_url} {...register('github_url')} />
            <Field label="LinkedIn" icon={Link2} placeholder="https://linkedin.com/in/your-name" error={errors.linkedin_url} {...register('linkedin_url')} />
          </div>
        </Section>
      </form>

      <PasswordCard />

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm text-slate-700">{hasErrors ? <span className="text-red-600">Please fix the highlighted fields.</span> : 'You have unsaved changes.'}</p>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => reset()}>Discard</Button>
              <Button type="submit" form="profile-form" disabled={updateMutation.isPending || hasErrors}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
