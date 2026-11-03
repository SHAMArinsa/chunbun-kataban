import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, CheckCircle2, Eye, FilePlus2, Mail, RefreshCw, Search, Send, XCircle } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import Table from '../../components/ui/Table'
import { KeyValues, PageHeader, Progress, Status, Tabs, TextArea } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { TIERS, downloadFile, errorText, fmtDate, fmtDateTime, humanize } from '../../lib/v2'

export default function Certificates() {
  const [tab, setTab] = useState('generate')
  return (
    <div>
      <PageHeader title="Certificates & Invoices" subtitle="Welcome Certificate and Payment Invoice are created automatically on payment; the Completion Certificate is issued here after verification. View, email or refresh any of them below." />
      <Tabs tabs={[{ key: 'generate', label: 'Issue Documents' }, { key: 'issued', label: 'Issued Certificates' }]} value={tab} onChange={setTab} />
      {tab === 'generate' ? <Generate onDone={() => setTab('issued')} /> : <Issued />}
    </div>
  )
}

function Generate({ onDone }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const [tier, setTier] = useState('basic')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(null)
  const [override, setOverride] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'cert-candidates', tier, search],
    queryFn: () => apiClient.get('/v2/staff/certificates/candidates', { params: { tier, search: search || undefined } }).then((r) => r.data.students),
  })
  const { data: verify } = useQuery({
    queryKey: ['v2', 'cert-verify', picked], enabled: !!picked,
    queryFn: () => apiClient.get(`/v2/staff/certificates/verify/${picked}`).then((r) => r.data),
  })
  const doc = useMutation({
    mutationFn: ({ url }) => apiClient.post(url),
    onSuccess: (r, v) => {
      const ds = r.data.delivery_status
      push(ds === 'failed' ? `Email failed${r.data.error ? `: ${r.data.error}` : ''}` : v.msg, ds === 'failed' ? 'error' : 'success')
      qc.invalidateQueries({ queryKey: ['v2', 'cert-candidates'] })
    },
    onError: (e) => push(errorText(e), 'error'),
  })
  const issue = useMutation({
    mutationFn: () => apiClient.post(`/v2/staff/certificates/issue/${picked}`, { send_email: true, override_reason: override || null }),
    onSuccess: (r) => {
      push(`Certificate ${r.data.number} issued · email ${r.data.delivery_status}`, r.data.delivery_status === 'sent' ? 'success' : 'info')
      setPicked(null); setOverride('')
      qc.invalidateQueries({ queryKey: ['v2'] })
    },
    onError: (e) => push(errorText(e), 'error'),
  })
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-medium text-slate-600">1. Tier</span>
        <select value={tier} onChange={(e) => { setTier(e.target.value); setPicked(null) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <span className="text-sm font-medium text-slate-600">2. Student</span>
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, student ID or registered email" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
        </div>
      </Card>
      <Card>
        {isLoading ? <Spinner /> : (
          <Table
            keyField="enrollment_id"
            rows={data || []}
            emptyMessage="No students found."
            columns={[
              { key: 'name', header: 'Student', render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">ID {r.student_number} · {r.email}</p></div> },
              { key: 'track_status', header: 'Workflow', render: (r) => <Status value={r.track_status} /> },
              {
                key: 'welcome', header: 'Welcome Certificate', render: (r) => (r.welcome ? (
                  <DocCell ok label={r.welcome.number} sub={`Issued ${fmtDate(r.welcome.issued_date)}`}
                    onView={() => downloadFile(`/v2/staff/certificates/${r.welcome.id}/download`, `${r.welcome.number}.pdf`, { open: true })}
                    onEmail={() => doc.mutate({ url: `/v2/staff/certificates/${r.welcome.id}/send`, msg: 'Welcome Certificate emailed' })}
                    onRefresh={() => doc.mutate({ url: `/v2/staff/certificates/welcome/${r.enrollment_id}`, msg: 'Welcome Certificate refreshed with the current design' })} />
                ) : r.status === 'pending_payment' ? <span className="text-xs text-slate-400">After payment</span>
                  : <Button variant="secondary" onClick={() => doc.mutate({ url: `/v2/staff/certificates/welcome/${r.enrollment_id}`, msg: 'Welcome Certificate issued' })}><FilePlus2 size={14} /> Issue</Button>),
              },
              {
                key: 'invoice', header: 'Payment Invoice', render: (r) => (r.invoice ? (
                  <DocCell ok={r.invoice.has_file} label={`${r.invoice.currency === 'INR' ? '₹' : '$'}${Number(r.invoice.amount).toLocaleString(r.invoice.currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2 })}`}
                    sub={r.invoice.paid_at ? `Paid ${fmtDate(r.invoice.paid_at)}` : 'Paid'}
                    onView={r.invoice.has_file ? () => downloadFile(`/v2/staff/invoices/${r.invoice.payment_id}/download`, `Invoice-${r.invoice.number}.pdf`, { open: true }) : null}
                    onEmail={() => doc.mutate({ url: `/v2/staff/invoices/${r.invoice.payment_id}/generate?send_email=true`, msg: 'Invoice emailed' })}
                    onRefresh={() => doc.mutate({ url: `/v2/staff/invoices/${r.invoice.payment_id}/generate`, msg: r.invoice.has_file ? 'Invoice refreshed with the current design' : 'Invoice generated' })}
                    refreshLabel={r.invoice.has_file ? 'Refresh' : 'Generate'} />
                ) : <span className="text-xs text-slate-400">No paid payment</span>),
              },
              {
                key: 'completion', header: 'Completion Certificate', render: (r) => (r.completion ? (
                  <DocCell ok label={r.completion.number} sub={`Issued ${fmtDate(r.completion.issued_date)}`}
                    onView={() => downloadFile(`/v2/staff/certificates/${r.completion.id}/download`, `${r.completion.number}.pdf`, { open: true })}
                    onEmail={() => doc.mutate({ url: `/v2/staff/certificates/${r.completion.id}/send`, msg: 'Completion Certificate emailed' })}
                    onRefresh={() => doc.mutate({ url: `/v2/staff/certificates/${r.completion.id}/regenerate`, msg: 'Completion Certificate refreshed with the current design' })} />
                ) : <Button disabled={r.status === 'pending_payment'} onClick={() => setPicked(r.enrollment_id)}><Award size={14} /> Verify & issue</Button>),
              },
            ]}
          />
        )}
      </Card>
      <Modal open={!!picked} onClose={() => setPicked(null)} wide title="3. Verify → Preview → Issue & Email"
        footer={<>
          <Button variant="secondary" onClick={() => downloadFile(`/v2/staff/certificates/preview/${picked}`, 'preview.pdf', { open: true })}><Eye size={15} /> Preview</Button>
          <Button disabled={issue.isPending || (!verify?.ready && override.trim().length < 3)} onClick={() => issue.mutate()}><Send size={15} /> Issue & send to registered email</Button>
        </>}>
        {!verify ? <Spinner /> : (
          <div className="space-y-4">
            <KeyValues items={[
              ['Student', verify.student.name], ['Student ID', verify.student.student_number], ['Email', verify.student.email],
              ['Program', verify.program], ['Progress', <Progress key="p" value={verify.progress.percent} />],
              ['Workflow status', <Status key="t" value={verify.progress.track_status} />],
              ['Latest evaluation', verify.evaluation ? humanize(verify.evaluation.result) : 'Not evaluated'],
            ]} />
            {verify.ready ? (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={16} /> Completion verified.</p>
            ) : (
              <div className="space-y-2">
                <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><XCircle size={16} /> Completion is not verified yet (workflow not complete and no passed/completed evaluation).</p>
                <TextArea label="Override reason (required to issue anyway, kept in certificate history)" value={override} onChange={(e) => setOverride(e.target.value)} rows={2} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function Issued() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [tier, setTier] = useState('')
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState(null)
  const [revoke, setRevoke] = useState(null)
  const [reason, setReason] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'certificates', tier, search],
    queryFn: () => apiClient.get('/v2/staff/certificates', { params: { tier: tier || undefined, search: search || undefined } }).then((r) => r.data),
  })
  const { data: hist } = useQuery({ queryKey: ['v2', 'cert-history', history], enabled: !!history, queryFn: () => apiClient.get(`/v2/staff/certificates/${history}/history`).then((r) => r.data) })
  const act = useMutation({
    mutationFn: ({ url, body }) => apiClient.post(url, body),
    onSuccess: (r) => { push(r.data.delivery_status ? `Email: ${r.data.delivery_status}${r.data.error ? ` – ${r.data.error}` : ''}` : 'Done', r.data.delivery_status === 'failed' ? 'error' : 'success'); setRevoke(null); setReason(''); qc.invalidateQueries({ queryKey: ['v2', 'certificates'] }) },
    onError: (e) => push(errorText(e), 'error'),
  })
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap gap-3 p-4">
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All programs</option>
          {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, email or certificate number" className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </Card>
      <Card>
        {isLoading ? <Spinner /> : (
          <Table
            rows={data}
            columns={[
              { key: 'number', header: 'Certificate ID' }, { key: 'type', header: 'Type', render: (r) => humanize(r.type) },
              { key: 'student', header: 'Student' }, { key: 'program', header: 'Program' },
              { key: 'issued_date', header: 'Issued', render: (r) => fmtDate(r.issued_date) },
              { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
              { key: 'delivery_status', header: 'Email', render: (r) => <span title={r.delivery_error || ''}><Status value={r.delivery_status} /></span> },
              {
                key: 'a', header: '', render: (r) => (
                  <div className="flex gap-3 text-xs">
                    <button className="text-brand-700 hover:underline" onClick={() => downloadFile(`/v2/staff/certificates/${r.id}/download`, `${r.number}.pdf`, { open: true })}>View</button>
                    {r.status !== 'revoked' && <button className="text-brand-700 hover:underline" onClick={() => act.mutate({ url: `/v2/staff/certificates/${r.id}/send` })}>{r.delivery_status === 'sent' ? 'Re-send' : 'Send'}</button>}
                    <button className="text-slate-600 hover:underline" onClick={() => setHistory(r.id)}>History</button>
                    {r.status !== 'revoked' && <button className="text-red-600 hover:underline" onClick={() => setRevoke(r)}>Revoke</button>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      <Modal open={!!history} onClose={() => setHistory(null)} title="Certificate history" wide>
        {!hist ? <Spinner /> : (
          <div className="space-y-3 text-sm">
            <ul className="space-y-1">{hist.events.map((e, i) => <li key={i}>{fmtDateTime(e.at)} · <b>{humanize(e.action)}</b> · {e.by}{e.reason ? ` · ${e.reason}` : ''}</li>)}</ul>
            <p className="text-xs font-semibold uppercase text-slate-500">Email delivery</p>
            <ul className="space-y-1">{hist.attempts.map((a, i) => <li key={i}>Attempt {a.number} · {fmtDateTime(a.at)} · <b>{a.status}</b>{a.error ? ` · ${a.error}` : ''}</li>)}</ul>
          </div>
        )}
      </Modal>
      <Modal open={!!revoke} onClose={() => setRevoke(null)} title={`Revoke ${revoke?.number}`} footer={<Button variant="danger" disabled={reason.length < 3} onClick={() => act.mutate({ url: `/v2/staff/certificates/${revoke.id}/revoke`, body: { reason } })}>Revoke</Button>}>
        <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  )
}

function DocCell({ ok, label, sub, onView, onEmail, onRefresh, refreshLabel = 'Refresh' }) {
  return (
    <div className="min-w-[170px]">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
        {ok ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> : <XCircle size={13} className="shrink-0 text-amber-500" />}
        <span className="truncate" title={label}>{label}</span>
      </p>
      {sub && <p className="ml-5 text-[11px] text-slate-500">{sub}</p>}
      <div className="ml-5 mt-1 flex flex-wrap gap-2.5 text-xs">
        {onView && <button className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline" onClick={onView}><Eye size={12} /> View</button>}
        {onEmail && <button className="inline-flex items-center gap-0.5 text-brand-700 hover:underline" onClick={onEmail}><Mail size={12} /> Email</button>}
        {onRefresh && <button className="inline-flex items-center gap-0.5 text-slate-600 hover:underline" title="Rebuild the PDF with the current design (same number & dates)" onClick={onRefresh}><RefreshCw size={12} /> {refreshLabel}</button>}
      </div>
    </div>
  )
}
