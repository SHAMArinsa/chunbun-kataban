import Badge from '../ui/Badge'
import { STATUS_COLORS, humanize } from '../../lib/v2'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Status({ value, label }) {
  if (!value) return <span className="text-slate-400">—</span>
  return <Badge color={STATUS_COLORS[value] || 'slate'}>{label || humanize(value)}</Badge>
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            value === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function TextArea({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
        rows={4}
        {...props}
      />
    </label>
  )
}

export function Stat({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600', slate: 'bg-slate-100 text-slate-600' }
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {Icon && <div className={`rounded-lg p-3 ${tones[tone]}`}><Icon size={20} /></div>}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900">{value ?? '—'}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

export function Progress({ value = 0 }) {
  const v = Math.max(0, Math.min(100, value || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500" style={{ width: `${v}%` }} /></div>
      <span className="text-xs text-slate-500">{v}%</span>
    </div>
  )
}

export function Section({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function KeyValues({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="text-sm font-medium text-slate-800">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
