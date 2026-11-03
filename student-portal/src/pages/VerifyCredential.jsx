import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { BadgeCheck, CalendarDays, Hash, Search, ShieldAlert, ShieldCheck, User, GraduationCap, Building2 } from 'lucide-react'
import { API_BASE_URL } from '../api/client'

const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—')

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-brand-600" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="break-words text-sm font-semibold text-slate-900">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function VerifyCredential() {
  const { credentialId = '' } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(credentialId)
  const id = credentialId.trim()
  const { data, isLoading, error } = useQuery({
    queryKey: ['credential', id],
    enabled: !!id,
    retry: false,
    queryFn: () => axios.get(`${API_BASE_URL}/public/credentials/${encodeURIComponent(id)}`).then((r) => r.data),
  })
  const notFound = error?.response?.status === 404

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">ARINSA AI MINDS</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Certificate Verification</h1>
        <p className="mt-2 text-sm text-slate-500">Enter a Credential ID to confirm an Internship Completion Certificate is genuine.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${encodeURIComponent(input.trim())}`) }}
        className="mx-auto mt-6 flex max-w-xl gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. ARN-CIC-2026-000123"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Search size={16} /> Verify
        </button>
      </form>

      <div className="mt-8">
        {!id ? null : isLoading ? (
          <p className="text-center text-sm text-slate-500">Checking…</p>
        ) : notFound ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <ShieldAlert size={36} className="mx-auto text-red-600" />
            <p className="mt-2 text-lg font-semibold text-red-800">No certificate found</p>
            <p className="mt-1 text-sm text-red-700">We couldn't find a certificate with Credential ID <span className="font-mono">{id}</span>. Please check the ID and try again.</p>
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-600">Couldn't check right now. Please try again in a moment.</p>
        ) : data && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            {data.status === 'valid' ? (
              <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-emerald-500 px-6 py-5 text-white">
                <ShieldCheck size={34} />
                <div><p className="text-lg font-bold">Verified certificate</p><p className="text-sm text-white/85">This certificate was issued by ARINSA AI MINDS and is valid.</p></div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-gradient-to-r from-red-700 to-red-500 px-6 py-5 text-white">
                <ShieldAlert size={34} />
                <div><p className="text-lg font-bold">Certificate revoked</p><p className="text-sm text-white/85">This certificate was issued but has since been revoked and is no longer valid.</p></div>
              </div>
            )}
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field icon={User} label="Awarded to" value={data.student_name} />
              <Field icon={Hash} label="Student ID" value={data.student_id} />
              <Field icon={GraduationCap} label="Program" value={data.program} />
              <Field icon={CalendarDays} label="Duration" value={data.duration} />
              <Field icon={CalendarDays} label="Internship period" value={`${fmt(data.start_date)} – ${fmt(data.end_date)}`} />
              <Field icon={CalendarDays} label="Date of issue" value={fmt(data.issued_date)} />
              <Field icon={BadgeCheck} label="Credential ID" value={<span className="font-mono">{data.credential_id}</span>} />
              <Field icon={Building2} label="Issued by" value={data.issuer} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
