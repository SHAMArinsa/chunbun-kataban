import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import apiClient from '../../api/client'
import Spinner from '../../components/ui/Spinner'
import { Pill, errorText } from '../../lib/v2'

const ICON = { met: <CheckCircle2 size={18} className="text-emerald-600" />, waived: <CheckCircle2 size={18} className="text-slate-400" />, not_met: <XCircle size={18} className="text-red-600" /> }

export default function Eligibility() {
  const { data, isLoading, error } = useQuery({ queryKey: ['v2', 'eligibility'], queryFn: () => apiClient.get('/v2/me/eligibility').then((r) => r.data) })
  if (isLoading) return <Spinner />
  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorText(error)}</p>
  const p = data.progress
  const criteria = data.criteria.filter((c) => c.code !== 'overall')
  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Placement Guarantee Eligibility</h1>
          <p className="text-sm text-slate-500">Placement support is subject to meeting every requirement below within the program period.</p>
        </div>
        <Pill value={data.overall} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Assignments', `${p.assignments_completed} / 22`], ['Real-world projects', `${p.projects_completed} / 3`], ['Total work', `${p.total_completed} / 25`], ['Mock interviews', `${p.mock_interviews_completed} / ${p.mock_interviews_required}`]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"><p className="text-xs text-slate-500">{k}</p><p className="text-lg font-semibold text-slate-900">{v}</p></div>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {criteria.map((c) => (
          <li key={c.code} className="flex items-start gap-3 px-5 py-3 text-sm">
            {ICON[c.state] || <Circle size={18} className="text-slate-300" />}
            <span className="flex-1 text-slate-800">{c.description}
              {!c.automatic && c.reason && c.reason !== 'Initial state' && <span className="mt-0.5 block text-xs text-slate-500">Feedback: {c.reason}</span>}
            </span>
            <Pill value={c.state} />
          </li>
        ))}
      </ul>
    </div>
  )
}
