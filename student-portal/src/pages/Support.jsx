import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, Inbox, Paperclip, TicketPlus } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import './Support.css'

const STATUS_COLOR = { open: 'yellow', in_progress: 'blue', resolved: 'green', closed: 'slate' }
const formatTicketId = (id) => `ARI${String(id).padStart(8, '0')}`

export default function Support() {
  const [tab, setTab] = useState('tickets')
  const [form, setForm] = useState({ subject: '', description: '', category: 'other', priority: 'medium' })
  const [ticketFile, setTicketFile] = useState(null)
  const navigate = useNavigate()
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { data: tickets, isLoading: loadingTickets } = useQuery({ queryKey: ['tickets', 'me'], queryFn: () => apiClient.get('/support/tickets/me').then((r) => r.data), refetchInterval: 8000 })
  const { data: faqs, isLoading: loadingFaqs } = useQuery({ queryKey: ['faqs'], queryFn: () => apiClient.get('/support/faqs').then((r) => r.data) })
  const createTicket = useMutation({
    mutationFn: (payload) => { const fd = new FormData(); Object.entries(payload).forEach(([key, value]) => fd.append(key, value)); if (ticketFile) fd.append('file', ticketFile); return apiClient.post('/support/tickets', fd, { headers: { 'Content-Type': 'multipart/form-data' } }) },
    onSuccess: () => { push('Ticket raised!', 'success'); queryClient.invalidateQueries({ queryKey: ['tickets'] }); setForm({ subject: '', description: '', category: 'other', priority: 'medium' }); setTicketFile(null) },
  })
  const visibleTickets = tickets?.filter((ticket) => tab === 'history' ? ticket.status === 'closed' : ticket.status !== 'closed')
  return <div className="support-page space-y-6">
    <section className="support-hero"><div><span className="support-eyebrow">HELP CENTRE</span><h1>How can we help?</h1><p>Browse your requests, send a message to our team, or find a quick answer.</p></div><div className="support-hero-icon"><HelpCircle size={30} /></div></section>
    <div className="support-tabs" role="tablist">{[['tickets', 'My Tickets'], ['history', 'Ticket History'], ['raise', 'Raise Ticket'], ['faq', 'FAQ']].map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`support-tab ${tab === value ? 'is-active' : ''}`}>{label}</button>)}</div>
    {(tab === 'tickets' || tab === 'history') && (loadingTickets ? <Spinner /> : visibleTickets?.length ? <Card className="student-ticket-list divide-y divide-slate-100"><div className="student-ticket-table-head"><span>Request ID</span><span>Subject</span><span>Last updated</span><span>Action</span></div>{visibleTickets.map((ticket) => <div key={ticket.id} className="student-ticket-row p-4"><button className="flex w-full items-center justify-between text-left" onClick={() => navigate(`/support/tickets/${ticket.id}`)}><div className="flex min-w-0 items-start gap-4"><span className="student-ticket-number">{formatTicketId(ticket.id)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{ticket.subject}</p><p className="mt-1 line-clamp-1 text-xs text-slate-500">{ticket.description}</p>{ticket.attachment_name && <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-600"><Paperclip size={11} /> Attachment included</span>}</div></div><div className="ml-4 flex shrink-0 items-center gap-2"><span className="student-ticket-updated">{new Date(ticket.updated_at).toLocaleDateString()}</span><Badge color={STATUS_COLOR[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge><span className="student-ticket-open">Open chat →</span></div></button></div>)}</Card> : <Card className="support-empty-state"><div className="support-empty-icon"><Inbox size={24} /></div><h2>No {tab === 'history' ? 'closed' : 'open'} tickets yet</h2><p>Need a hand? Create a ticket and our support team will get back to you here.</p><Button onClick={() => setTab('raise')}><TicketPlus size={16} /> Raise a ticket</Button></Card>)}
    {tab === 'raise' && <Card className="support-form-card max-w-lg space-y-5 p-6"><div className="support-form-heading"><span className="support-step">01</span><div><h2>Tell us what happened</h2><p>Include the relevant details so we can help faster.</p></div></div><Input label="Subject" value={form.subject} onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))} /><label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Description</span><textarea className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={4} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} /></label><Select label="Category" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}><option value="technical">Technical</option><option value="payment">Payment</option><option value="content">Content</option><option value="suspension">Suspension</option><option value="other">Other</option></Select><label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600"><Paperclip size={15} />{ticketFile ? ticketFile.name : 'Choose file'}<input type="file" className="hidden" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} /></label><Button onClick={() => createTicket.mutate(form)} disabled={!form.subject || !form.description || createTicket.isPending}>Submit Ticket</Button></Card>}
    {tab === 'faq' && (loadingFaqs ? <Spinner /> : <div className="space-y-3">{faqs?.map((faq) => <Card key={faq.id} className="p-4"><p className="text-sm font-medium text-slate-900">{faq.question}</p><p className="mt-1 text-xs text-slate-500">{faq.answer}</p></Card>)}</div>)}
  </div>
}
