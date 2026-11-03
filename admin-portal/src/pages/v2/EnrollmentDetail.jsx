import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import Table from '../../components/ui/Table'
import { KeyValues, PageHeader, Progress, Section, Status, Tabs, TextArea } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { TIERS, downloadFile, errorText, fmtDate, fmtDateTime, humanize, money } from '../../lib/v2'

export default function EnrollmentDetail() {
  const { enrollmentId } = useParams()
  const qc = useQueryClient()
  const { push } = useToast()
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'enrollment', enrollmentId],
    queryFn: () => apiClient.get(`/v2/staff/enrollments/${enrollmentId}`).then((r) => r.data),
  })

  const act = useMutation({
    mutationFn: ({ url, body }) => apiClient.post(url, body),
    onSuccess: (_r, v) => {
      push(v.ok || 'Saved', 'success')
      setModal(null)
      setForm({})
      qc.invalidateQueries({ queryKey: ['v2'] })
    },
    onError: (e) => push(errorText(e), 'error'),
  })

  const quote = useQuery({
    queryKey: ['v2', 'tier-quote', enrollmentId, form.new_tier],
    enabled: modal === 'tier' && !!form.new_tier,
    queryFn: () => apiClient.get(`/v2/staff/enrollments/${enrollmentId}/change-tier/quote`, { params: { new_tier: form.new_tier } }).then((r) => r.data),
  })
  const changeTier = useMutation({
    mutationFn: () => apiClient.post(`/v2/staff/enrollments/${enrollmentId}/change-tier`, { new_tier: form.new_tier, payment_reference: form.payment_reference, reason: form.reason || null }).then((r) => r.data),
    onSuccess: (r) => {
      push('Tier changed. New invoice and Welcome Certificate sent to the student.', 'success')
      setModal(null)
      setForm({})
      qc.invalidateQueries({ queryKey: ['v2'] })
      navigate(`/enrollments/${r.new_enrollment_id}`)
    },
    onError: (e) => push(errorText(e), 'error'),
  })

  if (isLoading || !data) return <Spinner />
  const { student, enrollment, progress, tier } = data
  const base = `/v2/staff/enrollments/${enrollmentId}`

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'work', label: 'Work & Submissions', count: data.work.length },
    { key: 'certificates', label: 'Certificates', count: data.certificates.length },
    { key: 'proctoring', label: 'Proctoring', count: data.proctoring.length },
    data.payments && { key: 'payments', label: 'Payments' },
    { key: 'notes', label: 'Admin Notes', count: data.notes.length },
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <PageHeader
        title={student.name}
        subtitle={`${data.tier_label} · Student ID ${student.student_number}`}
        actions={
          <>
            <Link to={`/work/${tier}`}><Button variant="secondary">Work Management</Button></Link>
            {data.can_manage_access && (
              <>
                {['active', 'completed', 'suspended'].includes(enrollment.status) && <Button variant="secondary" onClick={() => { setForm({}); setModal('tier') }}>Change Tier</Button>}
                <Button variant="secondary" onClick={() => setModal('extend')}>Extend Access</Button>
                {enrollment.status === 'suspended' ? (
                  <Button onClick={() => act.mutate({ url: `${base}/status`, body: { action: 'unlock' }, ok: 'Student unlocked' })}>Unlock</Button>
                ) : (
                  <Button variant="danger" onClick={() => setModal('suspend')}>Suspend</Button>
                )}
              </>
            )}
          </>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="space-y-5">
          <Section title="Enrollment">
            <KeyValues
              items={[
                ['Program status', <Status key="s" value={enrollment.access} />],
                ['Progress', <Progress key="p" value={progress.percent} />],
                ['Enrolled', fmtDate(enrollment.enrolled_at)],
                ['Start date', fmtDate(enrollment.start_date)],
                ['End date', fmtDate(enrollment.end_date)],
                ['Original end date', fmtDate(enrollment.original_end_date)],
                ['Days remaining', enrollment.days_remaining],
                enrollment.suspension_reason && ['Suspension reason', enrollment.suspension_reason],
                data.mcq && ['MCQ', data.mcq.attempts ? `${data.mcq.correct}/${data.mcq.total} · ${data.mcq.percentage}% · ${data.mcq.status}` : 'Not attempted'],
                data.internship_form && ['Internship form', `${humanize(data.internship_form.status)} (${humanize(data.internship_form.review_status)})`],
                progress.stage && ['Current stage', `Month ${progress.stage.month} – ${progress.stage.title}`],
                progress.total_required && ['Required work', `${progress.total_completed} / ${progress.total_required}`],
                progress.eligibility_status && ['Placement eligibility', <Status key="e" value={progress.eligibility_status} />],
              ]}
            />
          </Section>
          {data.other_enrollments?.length > 0 && (
            <Section title="Other programs for this student">
              <ul className="divide-y divide-slate-100 text-sm">
                {data.other_enrollments.map((o) => (
                  <li key={o.enrollment_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><Link className="font-medium text-brand-700 hover:underline" to={`/enrollments/${o.enrollment_id}`}>{o.tier_label}</Link> <span className="text-slate-400">· enrolled {fmtDate(o.enrolled_at)}</span>{o.note && <span className="block text-xs text-slate-500">{o.note}</span>}</span>
                    <Status value={o.status} label={o.status === 'dropped' ? 'Closed' : undefined} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Profile">
            <KeyValues
              items={[
                ['Email', student.email], ['Phone', student.phone], ['Institution', student.institution],
                ['Degree', student.degree], ['City', student.city], ['Country', student.country], ['Citizenship', humanize(student.citizenship)],
              ]}
            />
          </Section>
          <IdentityCard student={student} />
          {data.extensions.length > 0 && (
            <Section title="Access Extensions">
              <Table
                keyField="granted_at"
                rows={data.extensions}
                columns={[
                  { key: 'previous_end_date', header: 'From', render: (r) => fmtDate(r.previous_end_date) },
                  { key: 'new_end_date', header: 'To', render: (r) => fmtDate(r.new_end_date) },
                  { key: 'reason', header: 'Reason' },
                  { key: 'granted_by', header: 'Granted by' },
                  { key: 'granted_at', header: 'When', render: (r) => fmtDateTime(r.granted_at) },
                ]}
              />
            </Section>
          )}
        </div>
      )}

      {tab === 'work' && (
        <Section title="Work items">
          <Table
            keyField="project_id"
            emptyMessage="No work yet."
            rows={data.work}
            columns={[
              { key: 'label', header: 'Item' },
              { key: 'title', header: 'Title' },
              { key: 'deadline', header: 'Deadline', render: (r) => fmtDate(r.deadline) },
              { key: 'versions', header: 'Versions' },
              { key: 'status', header: 'Status', render: (r) => <Status value={r.status} label={r.status_label} /> },
            ]}
          />
        </Section>
      )}

      {tab === 'certificates' && (
        <Section title="Certificates" actions={<Link to="/certificates" className="text-xs text-brand-700 hover:underline">Certificate module</Link>}>
          <Table
            rows={data.certificates}
            columns={[
              { key: 'type', header: 'Type', render: (r) => humanize(r.type) },
              { key: 'number', header: 'Number' },
              { key: 'issued_date', header: 'Issued', render: (r) => fmtDate(r.issued_date) },
              { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
              { key: 'dl', header: '', render: (r) => <button className="text-brand-700 hover:underline" onClick={() => downloadFile(`/v2/staff/certificates/${r.id}/download`, `${r.number}.pdf`, { open: true })}>View</button> },
            ]}
          />
        </Section>
      )}

      {tab === 'proctoring' && (
        <Section title="Proctoring / suspension">
          <Table
            rows={data.proctoring}
            emptyMessage="No violations recorded."
            columns={[
              { key: 'type', header: 'Violation', render: (r) => humanize(r.type) },
              { key: 'category', header: 'Category' },
              { key: 'severity', header: 'Severity' },
              { key: 'at', header: 'When', render: (r) => fmtDateTime(r.at) },
              { key: 'reviewed', header: 'Reviewed', render: (r) => (r.reviewed ? 'Yes' : 'No') },
            ]}
          />
        </Section>
      )}

      {tab === 'payments' && data.payments && (
        <Section title="Payments">
          <Table
            rows={data.payments}
            columns={[
              { key: 'status', header: 'Status', render: (r) => <Status value={r.status === 'paid' ? 'active' : r.status} label={humanize(r.status)} /> },
              { key: 'base', header: 'Base', render: (r) => money(r.base, r.currency) },
              { key: 'fee', header: 'GST / Fee', render: (r) => `${money(r.fee, r.currency)} (${r.fee_type})` },
              { key: 'amount', header: 'Total', render: (r) => money(r.amount, r.currency) },
              { key: 'invoice_number', header: 'Invoice' },
              { key: 'razorpay_payment_id', header: 'Payment ID' },
              { key: 'paid_at', header: 'Paid', render: (r) => fmtDateTime(r.paid_at) },
              { key: 'inv', header: '', render: (r) => r.status === 'paid' && <button className="text-brand-700 hover:underline" onClick={() => downloadFile(`/v2/staff/invoices/${r.id}/download`, 'invoice.pdf', { open: true })}>Invoice</button> },
            ]}
          />
        </Section>
      )}

      {tab === 'notes' && (
        <Section title="Admin notes">
          <div className="mb-4 flex gap-2">
            <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Add a note (kept permanently)…" value={form.note || ''} onChange={(e) => setForm({ note: e.target.value })} />
            <Button disabled={!form.note?.trim()} onClick={() => act.mutate({ url: `/v2/staff/students/${student.id}/notes`, body: { note: form.note }, ok: 'Note added' })}>Add</Button>
          </div>
          <ul className="space-y-3">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="whitespace-pre-wrap text-slate-800">{n.note}</p>
                <p className="mt-1 text-xs text-slate-500">{n.author} · {fmtDateTime(n.at)}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Modal
        open={modal === 'tier'}
        onClose={() => setModal(null)}
        title="Change program tier"
        footer={<Button disabled={changeTier.isPending || !form.new_tier || (form.payment_reference || '').trim().length < 3 || !form.confirmed} onClick={() => changeTier.mutate()}>{changeTier.isPending ? 'Changing…' : 'Confirm tier change'}</Button>}
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Current program: <b>{data.tier_label}</b>. Ask the student to pay the <b>full price</b> of the new tier separately, then record it here.</p>
          <Select label="Move to" value={form.new_tier || ''} onChange={(e) => setForm({ ...form, new_tier: e.target.value })}>
            <option value="">— Select new tier —</option>
            {TIERS.filter((t) => t.key !== tier).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
          {form.new_tier && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {quote.isLoading ? 'Calculating…' : quote.data ? <>Amount the student must pay: <b>{money(quote.data.total, quote.data.currency)}</b> <span className="text-slate-500">({money(quote.data.base, quote.data.currency)} + {money(quote.data.fee, quote.data.currency)} {quote.data.fee_type === 'gst' ? 'GST' : 'platform fee'})</span></> : errorText(quote.error)}
            </div>
          )}
          <Input label="Payment reference (UPI / bank / Razorpay ID)" value={form.payment_reference || ''} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
          <TextArea label="Reason / note (optional)" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900">
            <input type="checkbox" className="mt-0.5" checked={!!form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })} />
            <span>I confirm the full payment has been received. The current program will be closed (its history is kept), and the new program starts today with a new invoice and Welcome Certificate emailed to the student.</span>
          </label>
        </div>
      </Modal>
      <Modal
        open={modal === 'extend'}
        onClose={() => setModal(null)}
        title="Extend program access"
        footer={<Button disabled={act.isPending} onClick={() => act.mutate({ url: `${base}/extend`, body: form, ok: 'Access extended' })}>Grant extension</Button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Current end date: <b>{fmtDate(enrollment.end_date)}</b></p>
          <Input label="New end date" type="date" value={form.new_end_date || ''} onChange={(e) => setForm({ ...form, new_end_date: e.target.value })} />
          <TextArea label="Reason (recorded permanently)" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
      </Modal>
      <Modal
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        title="Suspend student"
        footer={<Button variant="danger" disabled={act.isPending} onClick={() => act.mutate({ url: `${base}/status`, body: { action: 'suspend', reason: form.reason }, ok: 'Student suspended' })}>Suspend</Button>}
      >
        <TextArea label="Reason" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Modal>
    </div>
  )
}


const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving Licence', 'Other']

function IdentityCard({ student }) {
  const nid = student.national_id || {}
  const qc = useQueryClient()
  const { push } = useToast()
  const [edit, setEdit] = useState(null) // {type, number} while editing
  const [busy, setBusy] = useState('')
  const base = `/v2/staff/students/${student.id}`
  const refresh = () => qc.invalidateQueries({ queryKey: ['v2'] })
  const run = async (key, fn, ok) => {
    setBusy(key)
    try { await fn(); push(ok, 'success'); refresh() } catch (e) { push(errorText(e), 'error') } finally { setBusy('') }
  }
  const view = async (side) => {
    setBusy(`view-${side}`)
    try {
      const r = await apiClient.get(`${base}/national-id/${side}`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      let msg = 'Could not open this document'
      if (!e.response) msg += ' (server not reachable)'
      else {
        let text = ''
        try { text = await e.response.data.text() } catch { /* no body */ }
        try { msg = JSON.parse(text).detail || msg } catch { msg = `${msg} (error ${e.response.status}${text ? `: ${text.slice(0, 120)}` : ''})` }
      }
      push(msg, 'error')
    } finally { setBusy('') }
  }
  const upload = (side, file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    run(`up-${side}`, () => apiClient.post(`${base}/national-id/${side}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }), `${side === 'front' ? 'Front' : 'Back'} side uploaded`)
  }
  const missing = !nid.type || !nid.number || !nid.has_front || !nid.has_back
  const typeOptions = nid.type && !ID_TYPES.includes(nid.type) ? [nid.type, ...ID_TYPES] : ID_TYPES

  const Doc = ({ side, label }) => {
    const has = side === 'front' ? nid.has_front : nid.has_back
    const name = side === 'front' ? nid.front_name : nid.back_name
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`truncate text-sm ${has ? 'text-slate-800' : 'text-slate-400'}`}>{has ? (name || 'Uploaded') : 'Not uploaded'}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {has && <Button variant="secondary" disabled={busy === `view-${side}`} onClick={() => view(side)}>{busy === `view-${side}` ? 'Opening…' : 'View'}</Button>}
          {!nid.verified && (
            <label className={`inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${busy === `up-${side}` ? 'pointer-events-none opacity-60' : ''}`}>
              {busy === `up-${side}` ? 'Uploading…' : has ? 'Replace' : 'Upload'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { upload(side, e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
        </div>
      </div>
    )
  }

  return (
    <Section
      title="Identity verification"
      actions={nid.verified
        ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Verified &amp; locked</span>
        : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending verification</span>}
    >
      <div className="space-y-4">
        {edit ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">ID type</span>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>
                <option value="">Select ID</option>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">ID number</span>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={edit.number} maxLength={50} onChange={(e) => setEdit({ ...edit, number: e.target.value })} />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
              <Button disabled={busy === 'save'} onClick={() => run('save', () => apiClient.put(`${base}/national-id`, edit), 'ID details saved').then(() => setEdit(null))}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ID type</p>
              <p className="text-sm font-semibold text-slate-900">{nid.type || <span className="font-normal text-slate-400">Not provided</span>}</p>
            </div>
            <div className="flex items-start justify-between rounded-lg bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ID number</p>
                <p className="font-mono text-sm font-semibold text-slate-900">{nid.number || <span className="font-sans font-normal text-slate-400">Not provided</span>}</p>
              </div>
              {!nid.verified && <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setEdit({ type: nid.type || '', number: nid.number || '' })}>Edit</button>}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Doc side="front" label="Front side" />
          <Doc side="back" label="Back side" />
        </div>
        {!nid.verified && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {missing ? 'ID type, number and both sides are needed before verifying.' : 'Check the documents match the details above. Verifying locks them permanently.'}
            </p>
            <Button
              disabled={missing || busy === 'verify'}
              onClick={() => { if (window.confirm('Verify this ID? The details and files will be locked and cannot be changed.')) run('verify', () => apiClient.post(`${base}/national-id-verify`), 'ID verified and locked') }}
            >
              Verify &amp; lock
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}
