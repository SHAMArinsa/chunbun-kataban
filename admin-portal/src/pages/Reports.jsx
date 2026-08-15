import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const COLORS = ['#14b8a6', '#2dd4bf', '#5eead4', '#0d9488', '#0f766e']

export default function Reports() {
  const { data: revenue, isLoading: l1 } = useQuery({ queryKey: ['reports', 'revenue'], queryFn: () => apiClient.get('/reports/revenue').then((r) => r.data) })
  const { data: completion, isLoading: l2 } = useQuery({ queryKey: ['reports', 'completion-rate'], queryFn: () => apiClient.get('/reports/completion-rate').then((r) => r.data) })
  const { data: attendance, isLoading: l3 } = useQuery({ queryKey: ['reports', 'attendance-summary'], queryFn: () => apiClient.get('/reports/attendance-summary').then((r) => r.data) })
  const { data: performance, isLoading: l4 } = useQuery({ queryKey: ['reports', 'performance'], queryFn: () => apiClient.get('/reports/performance').then((r) => r.data) })

  if (l1 || l2 || l3 || l4) return <Spinner />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Reports & Analytics</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Revenue by Program</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="program" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Completion Rate by Program</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={completion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="program" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Bar dataKey="completion_rate_percent" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Attendance Breakdown</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={attendance} dataKey="count" nameKey="status" outerRadius={90} label>
                {attendance?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Average Performance by Type</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="evaluation_type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="average_score" fill="#5eead4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
