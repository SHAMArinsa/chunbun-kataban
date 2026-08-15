import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
import Modal from '../components/ui/Modal'

const CATEGORY_COLOR = { confirmed: 'red', suspicious: 'yellow' }
const VIOLATION_TYPES = [
  'COPY_ATTEMPT',
  'RIGHT_CLICK_ATTEMPT',
  'PRINT_ATTEMPT',
  'SAVE_ATTEMPT',
  'DEVTOOLS_SHORTCUT_ATTEMPT',
  'PRINTSCREEN_KEY_ATTEMPT',
  'PROTECTED_DOWNLOAD_ATTEMPT',
  'TAB_HIDDEN',
  'WINDOW_FOCUS_LOST',
  'FULLSCREEN_EXIT',
  'MULTIPLE_SESSION_CONFLICT',
  'SESSION_EXPIRED',
  'ASSESSMENT_WINDOW_LEFT',
]

export default function Proctoring() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [reviewedFilter, setReviewedFilter] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [notes, setNotes] = useState('')
  const [sessionCodeInput, setSessionCodeInput] = useState('')
  const [lookupCode, setLookupCode] = useState(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [assessmentIdFilter, setAssessmentIdFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [auditSessionCode, setAuditSessionCode] = useState('')
  const { push } = useToast()
  const queryClient = useQueryClient()

  const {
    data: sessionResult,
    isFetching: sessionLoading,
    isError: sessionError,
  } = useQuery({
    queryKey: ['watermark-session', lookupCode],
    queryFn: () => apiClient.get(`/proctoring/session/${lookupCode}`).then((r) => r.data),
    enabled: !!lookupCode,
    retry: false,
  })

  const params = {}
  if (categoryFilter) params.category = categoryFilter
  if (typeFilter) params.violation_type = typeFilter
  if (reviewedFilter) params.reviewed = reviewedFilter === 'true'
  if (studentSearch.trim()) params.student_search = studentSearch.trim()
  if (assessmentIdFilter.trim()) params.assessment_id = assessmentIdFilter.trim()
  if (auditSessionCode.trim()) params.session_code = auditSessionCode.trim()
  if (dateFrom) params.date_from = new Date(dateFrom).toISOString()
  if (dateTo) params.date_to = new Date(dateTo).toISOString()

  const { data: violations, isLoading } = useQuery({
    queryKey: ['proctoring-violations', categoryFilter, typeFilter, reviewedFilter, studentSearch, assessmentIdFilter, auditSessionCode, dateFrom, dateTo],
    queryFn: () => apiClient.get('/proctoring', { params }).then((r) => r.data),
  })

  const { data: activeViolation } = useQuery({
    queryKey: ['proctoring-violation', activeId],
    queryFn: () => apiClient.get(`/proctoring/${activeId}`).then((r) => r.data),
    enabled: !!activeId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] })
    queryClient.invalidateQueries({ queryKey: ['proctoring-violation', activeId] })
  }

  const reviewMutation = useMutation({
    mutationFn: () => apiClient.put(`/proctoring/${activeId}/review`, { reviewed: true, admin_notes: notes || null }),
    onSuccess: () => { push('Marked reviewed.', 'success'); invalidate() },
    onError: (err) => push(err.response?.data?.detail || 'Update failed', 'error'),
  })

  const suspendMutation = useMutation({
    mutationFn: () => apiClient.post('/proctoring/suspend', { enrollment_id: activeViolation.enrollment_id, reason: notes || 'Manual suspend from proctoring review' }),
    onSuccess: () => { push('Enrollment suspended.', 'success'); invalidate() },
    onError: (err) => push(err.response?.data?.detail || 'Suspend failed', 'error'),
  })

  const reinstateMutation = useMutation({
    mutationFn: () => apiClient.post('/proctoring/reinstate', { enrollment_id: activeViolation.enrollment_id, reason: notes || 'Reinstated from proctoring review' }),
    onSuccess: () => { push('Enrollment reinstated.', 'success'); invalidate() },
    onError: (err) => push(err.response?.data?.detail || 'Reinstate failed', 'error'),
  })

  if (isLoading) return <Spinner />

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'student', header: 'Student', render: (r) => <button className="text-left text-brand-600 hover:underline" onClick={() => { setActiveId(r.id); setNotes(r.admin_notes || '') }}>{r.student_full_name ?? `#${r.student_id}`}<span className="ml-1 text-xs text-slate-400">{r.student_email}</span></button> },
    { key: 'violation_type', header: 'Violation', render: (r) => r.violation_type.replace(/_/g, ' ') },
    { key: 'category', header: 'Category', render: (r) => <Badge color={CATEGORY_COLOR[r.category] ?? 'slate'}>{r.category}</Badge> },
    { key: 'assessment', header: 'Assessment', render: (r) => r.assessment_type ? `${r.assessment_type} #${r.assessment_id ?? '—'}` : '—' },
    { key: 'reviewed', header: 'Reviewed', render: (r) => <Badge color={r.reviewed ? 'green' : 'slate'}>{r.reviewed ? 'Yes' : 'No'}</Badge> },
    { key: 'created_at', header: 'Detected', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'action', header: '', render: (r) => <Button variant="secondary" onClick={() => { setActiveId(r.id); setNotes(r.admin_notes || '') }}>Open</Button> },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Proctoring &amp; Violations</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="w-56">
            <Input placeholder="Search student name or email…" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
          </div>
          <div className="w-32">
            <Input placeholder="Assessment ID" value={assessmentIdFilter} onChange={(e) => setAssessmentIdFilter(e.target.value)} />
          </div>
          <div className="w-36">
            <Input placeholder="Session ID" value={auditSessionCode} onChange={(e) => setAuditSessionCode(e.target.value.toUpperCase())} />
          </div>
          <div className="w-40">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="w-40">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="w-48">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              <option value="confirmed">Confirmed</option>
              <option value="suspicious">Suspicious</option>
            </Select>
          </div>
          <div className="w-56">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Violation Types</option>
              {VIOLATION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
          </div>
          <div className="w-40">
            <Select value={reviewedFilter} onChange={(e) => setReviewedFilter(e.target.value)}>
              <option value="">All</option>
              <option value="false">Unreviewed</option>
              <option value="true">Reviewed</option>
            </Select>
          </div>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Search Session</h2>
          <p className="text-xs text-slate-500">
            Paste the SESSION code visible in a leaked screenshot or recording's watermark (e.g. "A8F2K91") to identify
            the student, content, and time window it came from.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Input
              placeholder="e.g. A8F2K91"
              value={sessionCodeInput}
              onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && sessionCodeInput.trim() && setLookupCode(sessionCodeInput.trim())}
            />
          </div>
          <Button onClick={() => sessionCodeInput.trim() && setLookupCode(sessionCodeInput.trim())} disabled={!sessionCodeInput.trim()}>
            <Search size={15} /> Search
          </Button>
        </div>

        {sessionLoading && <p className="text-sm text-slate-500">Searching…</p>}
        {lookupCode && sessionError && <p className="text-sm text-red-600">No session found for code "{lookupCode}".</p>}
        {sessionResult && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-slate-400">Student</p><p className="text-slate-800">{sessionResult.student_full_name} ({sessionResult.student_email})</p></div>
            <div><p className="text-xs text-slate-400">Content</p><p className="text-slate-800">{sessionResult.assessment_type ?? '—'} {sessionResult.assessment_id ?? ''}</p></div>
            <div><p className="text-xs text-slate-400">Session Started</p><p className="text-slate-800">{new Date(sessionResult.started_at).toLocaleString()}</p></div>
            <div><p className="text-xs text-slate-400">Session Ended</p><p className="text-slate-800">{sessionResult.ended_at ? new Date(sessionResult.ended_at).toLocaleString() : 'Still open / not recorded'}</p></div>
            <div><p className="text-xs text-slate-400">IP Address</p><p className="text-slate-800">{sessionResult.ip_address ?? '—'}</p></div>
            <div><p className="text-xs text-slate-400">Security Events During Session</p><p className="text-slate-800">{sessionResult.violation_count}</p></div>
            <div className="col-span-full"><p className="text-xs text-slate-400">Route</p><p className="break-all text-slate-800">{sessionResult.route ?? '—'}</p></div>
          </div>
        )}
      </Card>

      <Card><Table columns={columns} rows={violations} emptyMessage="No proctoring violations recorded." /></Card>

      <Modal
        open={!!activeId}
        onClose={() => { setActiveId(null); setNotes('') }}
        title={activeViolation ? `Violation #${activeViolation.id} — ${activeViolation.violation_type.replace(/_/g, ' ')}` : ''}
        footer={
          activeViolation && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {activeViolation.enrollment_id && (
                  <>
                    <Button variant="danger" onClick={() => suspendMutation.mutate()} disabled={suspendMutation.isPending}>Suspend</Button>
                    <Button variant="secondary" onClick={() => reinstateMutation.mutate()} disabled={reinstateMutation.isPending}>Reinstate</Button>
                  </>
                )}
              </div>
              <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>Mark Reviewed</Button>
            </div>
          )
        }
      >
        {activeViolation && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-400">Student</p><p className="text-slate-800">{activeViolation.student_full_name} ({activeViolation.student_email})</p></div>
              <div><p className="text-xs text-slate-400">Category</p><Badge color={CATEGORY_COLOR[activeViolation.category] ?? 'slate'}>{activeViolation.category}</Badge></div>
              <div><p className="text-xs text-slate-400">Assessment</p><p className="text-slate-800">{activeViolation.assessment_type ?? '—'} {activeViolation.assessment_id ?? ''}</p></div>
              <div><p className="text-xs text-slate-400">Attempt / Resource</p><p className="text-slate-800">{activeViolation.attempt_id ?? '—'} / {activeViolation.resource_id ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Session ID</p><p className="text-slate-800">{activeViolation.session_code ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Route</p><p className="break-all text-slate-800">{activeViolation.route ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Detected</p><p className="text-slate-800">{new Date(activeViolation.created_at).toLocaleString()}</p></div>
            </div>
            <div>
              <p className="text-xs text-slate-400">User Agent</p>
              <p className="break-all text-xs text-slate-600">{activeViolation.user_agent ?? '—'}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Admin Notes</span>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes for this violation / suspension decision…"
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}
