import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award, CalendarDays, CheckCircle2, Download, Eye, GraduationCap, Lock, Mail, ReceiptText, Sparkles } from 'lucide-react'
import apiClient from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { downloadFile, errorText, fmtDate, fmtDateTime, useV2Overview } from '../../lib/v2'

const money = (amount, currency) => {
  const n = Number(amount || 0)
  return currency === 'INR'
    ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const METHOD = { manual_offline: 'Offline / Bank transfer', razorpay: 'Online (Razorpay)', upi: 'UPI', card: 'Card', netbanking: 'Net banking' }

function Actions({ url, fileName }) {
  const { push } = useToast()
  const [busy, setBusy] = useState(null)
  const run = async (open) => {
    setBusy(open ? 'view' : 'dl')
    try { await downloadFile(url, fileName, { open }) } catch (e) { push(errorText(e), 'error') } finally { setBusy(null) }
  }
  return (
    <div className="mt-auto flex gap-2 pt-4">
      <button type="button" onClick={() => run(true)} disabled={!!busy}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60">
        <Eye size={15} /> {busy === 'view' ? 'Opening…' : 'View'}
      </button>
      <button type="button" onClick={() => run(false)} disabled={!!busy}
        className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        <Download size={15} /> {busy === 'dl' ? 'Downloading…' : 'Download'}
      </button>
    </div>
  )
}

function Card({ tone = 'brand', icon: Icon, badge, title, subtitle, children, locked }) {
  const tones = {
    brand: 'from-[#0b2e59] via-[#1c426e] to-[#2b6ab3]',
    gold: 'from-[#3a2a06] via-[#7a5a12] to-[#c49a2c]',
    green: 'from-[#063b2c] via-[#0c5f45] to-[#15936a]',
  }
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${locked ? 'border-dashed border-slate-300' : 'border-slate-200'}`}>
      <div className={`relative flex items-center gap-3 bg-gradient-to-r px-5 py-4 text-white ${locked ? 'from-slate-400 to-slate-500' : tones[tone]}`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"><Icon size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight">{title}</p>
          <p className="truncate text-xs text-white/75">{subtitle}</p>
        </div>
        {badge}
      </div>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </article>
  )
}

const Row = ({ label, value, strong }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className={`text-right ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{value}</span>
  </div>
)
function CredentialLink({ number }) {
  const { push } = useToast()
  const url = `${window.location.origin}/verify/${number}`
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Credential URL</p>
      <div className="mt-1 flex items-center gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-brand-700 hover:underline">{url}</a>
        <button type="button" onClick={() => navigator.clipboard?.writeText(url).then(() => push('Link copied', 'success'))}
          className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">Copy</button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Add this to your LinkedIn or résumé — anyone can use it to verify your certificate.</p>
    </div>
  )
}
const Done = ({ text = 'Issued' }) => <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={12} /> {text}</span>

export default function Certificates() {
  const { data: certs, isLoading } = useQuery({ queryKey: ['v2', 'certificates'], queryFn: () => apiClient.get('/v2/me/certificates').then((r) => r.data) })
  const { data: invoices, isLoading: invLoading } = useQuery({ queryKey: ['v2', 'invoices'], queryFn: () => apiClient.get('/v2/me/invoices').then((r) => r.data) })
  const { data: overview } = useV2Overview()
  if (isLoading || invLoading) return <Spinner />

  const welcome = (certs || []).find((c) => c.type === 'welcome')
  const completion = (certs || []).find((c) => c.type === 'internship_completion')
  const others = (certs || []).filter((c) => c !== welcome && c !== completion)
  const program = overview?.program?.name || welcome?.program || ''
  const endDate = overview?.enrollment?.end_date

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Certificates & Invoices</h1>
        <p className="text-sm text-slate-500">Your official ARINSA AI MINDS documents. Your Welcome Certificate and invoice were also emailed to your registered address.</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-slate-700">
        <Mail size={17} className="mt-0.5 shrink-0 text-brand-600" />
        <span>Keep these PDFs safe — they are your proof of enrolment, payment and completion. You can download them again here at any time.</span>
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Welcome certificate */}
        {welcome ? (
          <Card icon={Sparkles} title="Welcome Certificate" subtitle={welcome.program} badge={<Done />}>
            <Row label="Issued on" value={fmtDate(welcome.issued_date)} strong />
            <Row label="Reference" value={<span className="font-mono text-xs">{welcome.number}</span>} />
            <p className="mt-2 text-xs text-slate-500">Confirms your enrolment in the {welcome.program}.</p>
            <Actions url={`/v2/me/certificates/${welcome.id}/download`} fileName={`Welcome-Certificate-${welcome.number}.pdf`} />
          </Card>
        ) : (
          <Card locked icon={Sparkles} title="Welcome Certificate" subtitle={program}>
            <p className="text-sm text-slate-500">Issued automatically once your payment is confirmed.</p>
          </Card>
        )}

        {/* Completion certificate */}
        {completion ? (
          <Card tone="gold" icon={GraduationCap} title="Completion Certificate" subtitle={completion.program} badge={<Done />}>
            <Row label="Issued on" value={fmtDate(completion.issued_date)} strong />
            <Row label="Credential ID" value={<span className="font-mono text-xs">{completion.number}</span>} />
            <CredentialLink number={completion.number} />
            <p className="mt-2 text-xs text-slate-500">Congratulations on completing your internship! 🎉</p>
            <Actions url={`/v2/me/certificates/${completion.id}/download`} fileName={`Completion-Certificate-${completion.number}.pdf`} />
          </Card>
        ) : (
          <Card locked icon={GraduationCap} title="Completion Certificate" subtitle={program}
            badge={<span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-600"><Lock size={11} /> Locked</span>}>
            <p className="text-sm text-slate-600">Issued by ARINSA AI MINDS after you complete all the work in your program and it is verified.</p>
            {endDate && <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} /> Program ends {fmtDate(endDate)}</p>}
            <p className="mt-auto pt-4 text-xs text-slate-400">It will appear here and be emailed to you when it's issued.</p>
          </Card>
        )}

        {/* Latest invoice */}
        {invoices?.length ? (() => {
          const i = invoices[0]
          return (
            <Card tone="green" icon={ReceiptText} title="Payment Invoice" subtitle={i.program} badge={<Done text="Paid" />}>
              <p className="text-2xl font-bold text-slate-900">{money(i.amount, i.currency)}</p>
              {i.fee_amount > 0 && (
                <p className="mb-2 text-xs text-slate-500">{money(i.base_amount, i.currency)} + {i.fee_percent}% {i.fee_type === 'gst' ? 'GST' : 'fee'} {money(i.fee_amount, i.currency)}</p>
              )}
              <Row label="Paid on" value={fmtDateTime(i.paid_at)} />
              <Row label="Payment method" value={METHOD[i.method] || (i.method || '—').replace(/_/g, ' ')} />
              <Row label="Invoice No." value={<span className="font-mono text-xs">{i.invoice_number}</span>} />
              <Actions url={`/v2/me/invoices/${i.payment_id}/download`} fileName={`Invoice-${i.invoice_number}.pdf`} />
            </Card>
          )
        })() : (
          <Card locked icon={ReceiptText} title="Payment Invoice" subtitle={program}>
            <p className="text-sm text-slate-500">Your invoice appears here once your payment is confirmed.</p>
          </Card>
        )}
      </section>

      {/* Anything beyond the three main documents */}
      {(invoices?.length > 1 || others.length > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Other documents</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {others.map((c) => (
              <div key={`c${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Award size={18} className="text-brand-600" />
                <span className="flex-1">{c.program} · {fmtDate(c.issued_date)}</span>
                <button onClick={() => downloadFile(`/v2/me/certificates/${c.id}/download`, `${c.number}.pdf`)} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Download size={15} /> Download</button>
              </div>
            ))}
            {(invoices || []).slice(1).map((i) => (
              <div key={`i${i.payment_id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <ReceiptText size={18} className="text-emerald-600" />
                <span className="flex-1">Invoice · {i.program} · <b>{money(i.amount, i.currency)}</b> · {fmtDate(i.paid_at)}</span>
                <button onClick={() => downloadFile(`/v2/me/invoices/${i.payment_id}/download`, `Invoice-${i.invoice_number}.pdf`)} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Download size={15} /> Download</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
