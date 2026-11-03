import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { PageHeader } from '../../components/v2/Kit'
import { useAuth } from '../../context/AuthContext'
import { TIERS, downloadFile, fmtDateTime, humanize } from '../../lib/v2'

const REPORTS = [
  ['enrollment', 'Enrollment'], ['progress', 'Student progress'], ['mcq', 'MCQ results'], ['submissions', 'Projects / assignments / submissions'],
  ['internship', 'Internship status'], ['mock_interviews', 'Mock interviews'], ['eligibility', 'Accelerator eligibility'], ['certificates', 'Certificates'],
]

const cell = (v) => (v == null ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? fmtDateTime(v) : String(v))

export default function Reports() {
  const { isAdmin } = useAuth()
  const [kind, setKind] = useState('enrollment')
  const [tier, setTier] = useState('')
  const reports = isAdmin ? [...REPORTS, ['payments', 'Payments (financial)']] : REPORTS
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'report', kind, tier],
    queryFn: () => apiClient.get(`/v2/staff/reports/${kind}`, { params: { tier: tier || undefined } }).then((r) => r.data.rows),
  })
  const cols = data?.length ? Object.keys(data[0]).filter((k) => k !== 'enrollment_id') : []
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle={isAdmin ? undefined : 'Academic reports. Financial reports are available to Admin only.'}
        actions={<Button variant="secondary" onClick={() => downloadFile(`/v2/staff/reports/${kind}?export=true${tier ? `&tier=${tier}` : ''}`, `${kind}-report.csv`)}><Download size={15} /> Export CSV</Button>} />
      <Card className="flex flex-wrap gap-3 p-4">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {reports.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All programs</option>
          {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <span className="self-center text-sm text-slate-500">{data?.length ?? 0} rows</span>
      </Card>
      <Card className="overflow-x-auto">
        {isLoading ? <Spinner /> : !data?.length ? <p className="p-8 text-center text-sm text-slate-500">No data for this report.</p> : (
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-slate-500">{cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2 font-medium">{humanize(c)}</th>)}</tr></thead>
            <tbody>{data.map((r, i) => <tr key={i} className="border-b border-slate-100">{cols.map((c) => <td key={c} className="whitespace-nowrap px-4 py-2 text-slate-700">{cell(r[c])}</td>)}</tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
