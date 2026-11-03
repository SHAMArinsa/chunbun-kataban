import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'

export const fmtDate = (v) => (v ? new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
export const humanize = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—')
export const errorText = (err, fallback = 'Something went wrong') => {
  const d = err?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg?.replace(/^Value error, /, '')).join('; ')
  return d || err?.message || fallback
}
export const durationLabel = (n, unit = 'weeks') => {
  const s = String(unit).replace(/s$/, '')
  return `${n} ${s.charAt(0).toUpperCase()}${s.slice(1)}${Number(n) === 1 ? '' : 's'}`
}

export async function downloadFile(url, fallbackName = 'download', { open = false } = {}) {
  const res = await apiClient.get(url, { responseType: 'blob' })
  const match = /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] || '')
  const blobUrl = URL.createObjectURL(res.data)
  if (open) window.open(blobUrl, '_blank', 'noopener')
  else {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = match?.[1] || fallbackName
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

/** Which portal a logged-in student belongs to: 'v2' (five new programs), 'legacy' or 'none'. */
export function useV2Status() {
  return useQuery({ queryKey: ['v2', 'status'], queryFn: () => apiClient.get('/v2/me/status').then((r) => r.data), staleTime: 30_000 })
}

export function useV2Overview(enabled = true) {
  return useQuery({ queryKey: ['v2', 'overview'], enabled, queryFn: () => apiClient.get('/v2/me/overview').then((r) => r.data) })
}

export const STATUS_STYLE = {
  graded: 'bg-emerald-100 text-emerald-700', submitted: 'bg-amber-100 text-amber-700', under_review: 'bg-amber-100 text-amber-700',
  revision_requested: 'bg-red-100 text-red-700', in_progress: 'bg-slate-100 text-slate-600', active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700', scheduled: 'bg-brand-100 text-brand-700', completed: 'bg-emerald-100 text-emerald-700',
  met: 'bg-emerald-100 text-emerald-700', not_met: 'bg-red-100 text-red-700', pending: 'bg-slate-100 text-slate-600',
  waived: 'bg-slate-100 text-slate-600', eligible: 'bg-emerald-100 text-emerald-700', not_eligible: 'bg-red-100 text-red-700',
}
export function Pill({ value, label }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[value] || 'bg-slate-100 text-slate-600'}`}>{label || humanize(value)}</span>
}
