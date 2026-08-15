import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Paperclip, Inbox, LifeBuoy } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import Table from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import './Support.css'

const STATUS_COLOR = { open: 'yellow', in_progress: 'blue', resolved: 'green', closed: 'slate' }
const PRIORITY_COLOR = { low: 'slate', medium: 'blue', high: 'red' }
const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const formatTicketId = (id) => `ARI${String(id).padStart(8, '0')}`

async function downloadAttachment(url, fileName) {
  try {
    const res = await apiClient.get(url, { responseType: 'blob' })
    const blobUrl = window.URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName || 'attachment'
    a.click()
    window.URL.revokeObjectURL(blobUrl)
  } catch {
    // ignore
  }
}

export default function Support() {
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView] = useState('active')
  const [search, setSearch] = useState('')
  const [activeTicketId, setActiveTicketId] = useState(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [replyFile, setReplyFile] = useState(null)
  const [seenReplyIds, setSeenReplyIds] = useState(() => JSON.parse(localStorage.getItem('support-seen-replies') || '{}'))
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', statusFilter],
    queryFn: () => apiClient.get('/support/tickets', { params: statusFilter ? { status_filter: statusFilter } : {} }).then((r) => r.data),
    refetchInterval: 8000,
  })

  const { data: activeTicket } = useQuery({
    queryKey: ['support-ticket', activeTicketId],
    queryFn: () => apiClient.get(`/support/tickets/${activeTicketId}`).then((r) => r.data),
    enabled: !!activeTicketId,
    refetchInterval: activeTicketId ? 3000 : false,
  })

  const markTicketRead = (ticket) => {
    const newestStudentReply = ticket?.replies?.filter((reply) => reply.sender_role !== 'admin').at(-1)
    if (!newestStudentReply) return
    setSeenReplyIds((current) => {
      if ((current[ticket.id] ?? 0) >= newestStudentReply.id) return current
      const next = { ...current, [ticket.id]: newestStudentReply.id }
      localStorage.setItem('support-seen-replies', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (activeTicket) markTicketRead(activeTicket)
  }, [activeTicket])

  const unreadCount = (ticket) => ticket.replies?.filter((reply) => reply.sender_role !== 'admin' && reply.id > (seenReplyIds[ticket.id] ?? 0)).length ?? 0
  const visibleTickets = tickets?.filter((ticket) => {
    const inView = view === 'history' ? ['resolved', 'closed'].includes(ticket.status) : !['resolved', 'closed'].includes(ticket.status)
    const term = search.trim().toLowerCase()
    return inView && (!term || [formatTicketId(ticket.id), ticket.subject, ticket.student_full_name, ticket.student_email, ticket.category].some((value) => value?.toLowerCase().includes(term)))
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
    queryClient.invalidateQueries({ queryKey: ['support-ticket', activeTicketId] })
  }

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus) => apiClient.put(`/support/tickets/${activeTicketId}`, { status: newStatus }),
    onSuccess: () => { push('Ticket updated.', 'success'); invalidate() },
    onError: (err) => push(err.response?.data?.detail || 'Update failed', 'error'),
  })

  const replyMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('message', replyMessage)
      if (replyFile) fd.append('file', replyFile)
      return apiClient.post(`/support/tickets/${activeTicketId}/replies`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      push('Reply sent.', 'success')
      setReplyMessage('')
      setReplyFile(null)
      invalidate()
    },
    onError: (err) => push(err.response?.data?.detail || 'Reply failed', 'error'),
  })

  if (isLoading) return <Spinner />

  const columns = [
    { key: 'id', header: 'Request ID', render: (r) => <span className="admin-request-id">{formatTicketId(r.id)}</span> },
    { key: 'subject', header: 'Subject', render: (r) => <button className="text-left text-brand-600 hover:underline" onClick={() => navigate(`/support/tickets/${r.id}`)}>{r.subject}</button> },
    { key: 'student', header: 'Student', render: (r) => <span>{r.student_full_name ?? '—'}<span className="ml-1 text-xs text-slate-400">{r.student_email}</span></span> },
    { key: 'category', header: 'Category', render: (r) => r.category.replace('_', ' ') },
    { key: 'priority', header: 'Priority', render: (r) => <Badge color={PRIORITY_COLOR[r.priority] ?? 'slate'}>{r.priority}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.status] ?? 'slate'}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'replies', header: 'Replies', render: (r) => <span className="inline-flex items-center gap-2">{r.replies?.length ?? 0}{unreadCount(r) > 0 && <span className="support-unread-badge" title={`${unreadCount(r)} unread message${unreadCount(r) === 1 ? '' : 's'}`}>{unreadCount(r)}</span>}</span> },
    { key: 'updated_at', header: 'Last Updated', render: (r) => new Date(r.updated_at).toLocaleString() },
    { key: 'action', header: '', render: (r) => <Button variant="secondary" onClick={() => navigate(`/support/tickets/${r.id}`)}>Open</Button> },
  ]

  return (
    <div className="admin-support-page space-y-6">
      <section className="admin-support-hero">
        <div>
          <span>SUPPORT OPERATIONS</span>
          <h1>Support inbox</h1>
          <p>Review student requests, respond quickly, and keep every issue on track.</p>
        </div>
        <div className="admin-support-hero-icon"><LifeBuoy size={29} /></div>
      </section>
      <div className="admin-support-toolbar">
        <div><h2>{view === 'history' ? 'Ticket history' : 'Active requests'}</h2><p>{visibleTickets?.length ?? 0} ticket{visibleTickets?.length === 1 ? '' : 's'} in this view</p></div>
        <div className="flex items-center gap-3">
          <input className="admin-support-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets…" aria-label="Search tickets" />
          <div className="w-56">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          </div>
        </div>
      </div>
      <div className="admin-support-tabs"><button className={view === 'active' ? 'is-active' : ''} onClick={() => setView('active')}>Active Requests</button><button className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}>Ticket History</button></div>
      <div className="admin-status-strip">
        {STATUSES.map((status) => <div key={status} className={`admin-status-summary ${status}`}><span className="admin-status-dot" /><div><b>{tickets?.filter((ticket) => ticket.status === status).length ?? 0}</b><small>{status.replace('_', ' ')}</small></div></div>)}
      </div>

      <Card className="admin-support-table-card">
        {visibleTickets?.length ? <Table columns={columns} rows={visibleTickets} /> : <div className="admin-support-empty"><div><Inbox size={26} /></div><h3>{view === 'history' ? 'No ticket history yet' : 'Your active inbox is clear'}</h3><p>{view === 'history' ? 'Resolved and closed tickets will appear here.' : 'New active student requests will appear here.'}</p></div>}
      </Card>

      <Modal
        open={!!activeTicketId}
        onClose={() => { setActiveTicketId(null); setReplyMessage(''); setReplyFile(null) }}
        title={activeTicket ? `#${activeTicket.id} — ${activeTicket.subject}` : ''}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="w-52">
              <Select value={activeTicket?.status ?? ''} onChange={(e) => updateStatusMutation.mutate(e.target.value)} disabled={updateStatusMutation.isPending}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </Select>
            </div>
            <Button onClick={() => replyMutation.mutate()} disabled={!replyMessage.trim() || replyMutation.isPending}>Send Reply</Button>
          </div>
        }
        fullScreen
      >
        {activeTicket && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{activeTicket.student_full_name} ({activeTicket.student_email})</span>
              <Badge color={PRIORITY_COLOR[activeTicket.priority] ?? 'slate'}>{activeTicket.priority} priority</Badge>
              <Badge color="slate">{activeTicket.category.replace('_', ' ')}</Badge>
              <span>Opened {new Date(activeTicket.created_at).toLocaleString()}</span>
            </div>
            <div className="admin-ticket-request"><span>Subject</span><h4>{activeTicket.subject}</h4><span>Student request</span><p className="whitespace-pre-wrap">{activeTicket.description}</p></div>
            {activeTicket.attachment_name && (
              <button
                onClick={() => downloadAttachment(`/support/tickets/${activeTicket.id}/attachment`, activeTicket.attachment_name)}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                <Download size={12} /> {activeTicket.attachment_name}
              </button>
            )}

            <div className="max-h-[38vh] space-y-3 overflow-y-auto border-t border-slate-200 pt-3">
              {activeTicket.replies?.length ? (
                activeTicket.replies.map((r) => (
                  <div key={r.id} className={`rounded-lg p-3 text-sm ${r.sender_role === 'admin' ? 'bg-brand-50' : 'bg-slate-50'}`}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{r.sender_name ?? 'Unknown'} {r.sender_role === 'admin' ? '(Admin)' : ''}</span>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{r.message}</p>
                    {r.attachment_name && (
                      <button
                        onClick={() => downloadAttachment(`/support/tickets/${activeTicket.id}/replies/${r.id}/attachment`, r.attachment_name)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      >
                        <Download size={11} /> {r.attachment_name}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No replies yet.</p>
              )}
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Reply</span>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none"
                rows={2}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Write a response to the student…"
              />
            </label>
            <label className="admin-reply-attachment flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-500 hover:text-brand-600">
              <Paperclip size={13} />
              {replyFile ? replyFile.name : 'Attach file'}
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.docx,.txt,.jpeg,.jpg,.png"
                className="hidden"
                onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}
