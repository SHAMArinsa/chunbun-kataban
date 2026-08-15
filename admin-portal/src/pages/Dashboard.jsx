import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Users, IndianRupee, ClipboardCheck, Award } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="rounded-lg bg-brand-50 p-3 text-brand-600">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900">{value}</p>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports', 'dashboard-summary'],
    queryFn: () => apiClient.get('/reports/dashboard-summary').then((r) => r.data),
  })
  const { data: enrollmentReport } = useQuery({
    queryKey: ['reports', 'enrollment'],
    queryFn: () => apiClient.get('/reports/enrollment').then((r) => r.data),
  })
  const { data: activity } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => apiClient.get('/activity-logs?limit=10').then((r) => r.data),
  })

  if (isLoading) return <Spinner />

  const chartData = Object.values(
    (enrollmentReport ?? []).reduce((acc, row) => {
      if (!acc[row.program]) acc[row.program] = { program: row.program, count: 0 }
      acc[row.program].count += row.count
      return acc
    }, {})
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Students" value={summary?.total_students ?? 0} />
        <StatCard icon={IndianRupee} label="Revenue (INR)" value={`₹${summary?.revenue_inr?.toLocaleString() ?? 0}`} />
        <StatCard icon={ClipboardCheck} label="Pending Reviews" value={summary?.pending_reviews ?? 0} />
        <StatCard icon={Award} label="Certificates Issued" value={summary?.certificates_issued ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Enrollments by Program</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="program" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent Activity</h2>
          {activity?.length ? (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{a.action.replace(/_/g, ' ')}</span>
                  {a.description ? ` — ${a.description}` : ''}
                  <span className="ml-2 text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No recent activity.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
