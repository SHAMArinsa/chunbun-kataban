import apiClient from '../api/client'

export const TIERS = [
  { key: 'basic', label: 'Basic Internship', short: 'Basic' },
  { key: 'professional', label: 'Professional Internship', short: 'Professional' },
  { key: 'advanced', label: 'Advanced Internship', short: 'Advanced' },
  { key: 'career', label: 'Career Internship', short: 'Career' },
  { key: 'accelerator', label: 'Career Accelerator', short: 'Accelerator' },
]
export const tierLabel = (key) => TIERS.find((t) => t.key === key)?.label ?? key

export const fmtDate = (v) => (v ? new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
export const money = (amount, currency = 'INR') =>
  amount == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)

export const errorText = (err, fallback = 'Something went wrong') => {
  const d = err?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg?.replace(/^Value error, /, '')).join('; ')
  return d || err?.message || fallback
}

/** Download an authenticated file and save it (or open PDFs in a new tab). */
export async function downloadFile(url, fallbackName = 'download', { open = false } = {}) {
  const res = await apiClient.get(url, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] || ''
  const match = /filename="?([^"]+)"?/.exec(disposition)
  const blobUrl = URL.createObjectURL(res.data)
  if (open) {
    window.open(blobUrl, '_blank', 'noopener')
  } else {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = match?.[1] || fallbackName
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

export const STATUS_COLORS = {
  active: 'green', completed: 'blue', graded: 'blue', passed: 'green', met: 'green', eligible: 'green', sent: 'green', issued: 'green', accepted: 'green',
  submitted: 'yellow', under_review: 'yellow', pending: 'yellow', in_progress: 'slate', scheduled: 'yellow', draft: 'slate',
  revision_requested: 'red', revision_required: 'red', failed: 'red', not_met: 'red', suspended: 'red', expired: 'red', revoked: 'red', not_eligible: 'red',
  pending_payment: 'yellow', waived: 'slate', not_started: 'slate', locked: 'slate', not_selected: 'slate', cancelled: 'slate',
}
export const humanize = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—')
export const durationLabel = (n, unit = 'weeks') => {
  const singular = String(unit).replace(/s$/, '')
  return `${n} ${singular.charAt(0).toUpperCase()}${singular.slice(1)}${Number(n) === 1 ? '' : 's'}`
}
