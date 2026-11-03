import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import { PageHeader, Status } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { errorText, fmtDateTime, humanize } from '../../lib/v2'

export default function EmailDeliveries() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [status, setStatus] = useState('')
  const { data } = useQuery({ queryKey: ['v2', 'deliveries', status], queryFn: () => apiClient.get('/v2/staff/deliveries', { params: { status: status || undefined } }).then((r) => r.data) })
  const retry = useMutation({
    mutationFn: (id) => apiClient.post(`/v2/staff/deliveries/${id}/retry`),
    onSuccess: (r) => { push(r.data.status === 'sent' ? 'Sent' : `Failed: ${r.data.error}`, r.data.status === 'sent' ? 'success' : 'error'); qc.invalidateQueries({ queryKey: ['v2', 'deliveries'] }) },
    onError: (e) => push(errorText(e), 'error'),
  })
  return (
    <div className="space-y-4">
      <PageHeader title="Email Deliveries" subtitle="Automatic invoices, Welcome Certificates and completion certificates. Failed emails can be retried once email (SMTP) is configured." />
      <Card className="p-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All</option><option value="failed">Failed</option><option value="sent">Sent</option><option value="pending">Pending</option>
        </select>
      </Card>
      <Card>
        <Table rows={data} emptyMessage="No emails yet." columns={[
          { key: 'created_at', header: 'Created', render: (r) => fmtDateTime(r.created_at) },
          { key: 'student', header: 'Student' }, { key: 'recipient', header: 'Email' },
          { key: 'document_type', header: 'Document', render: (r) => humanize(r.document_type) },
          { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
          { key: 'attempts', header: 'Attempts' },
          { key: 'error', header: 'Last error', render: (r) => <span className="block max-w-xs truncate text-xs text-red-600" title={r.error}>{r.error}</span> },
          { key: 'r', header: '', render: (r) => r.status !== 'sent' && <Button variant="secondary" onClick={() => retry.mutate(r.id)}>Retry</Button> },
        ]} />
      </Card>
    </div>
  )
}
