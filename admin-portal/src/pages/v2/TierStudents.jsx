import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import apiClient from '../../api/client'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Spinner from '../../components/ui/Spinner'
import { PageHeader, Status } from '../../components/v2/Kit'
import { fmtDate, tierLabel } from '../../lib/v2'

export default function TierStudents() {
  const { tier } = useParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'students', tier, search, status],
    queryFn: () => apiClient.get('/v2/staff/students', { params: { tier, search: search || undefined, status: status || undefined } }).then((r) => r.data),
  })

  return (
    <div>
      <PageHeader title={`${tierLabel(tier)} Students`} subtitle="Only students registered in this program are shown." />
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, student ID or email"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_payment">Payment pending</option>
          <option value="suspended">Suspended</option>
          <option value="completed">Completed</option>
        </select>
      </Card>
      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table
            keyField="enrollment_id"
            emptyMessage="No students in this program yet."
            rows={data?.students}
            columns={[
              { key: 'student_number', header: 'Student ID' },
              { key: 'name', header: 'Name', render: (r) => <Link to={`/enrollments/${r.enrollment_id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link> },
              { key: 'email', header: 'Email' },
              { key: 'start_date', header: 'Start', render: (r) => fmtDate(r.start_date) },
              { key: 'end_date', header: 'End', render: (r) => fmtDate(r.end_date) },
              { key: 'days_remaining', header: 'Days left' },
              { key: 'access', header: 'Status', render: (r) => <Status value={r.access} /> },
              { key: 'track_status', header: 'Progress', render: (r) => <Status value={r.track_status} /> },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
