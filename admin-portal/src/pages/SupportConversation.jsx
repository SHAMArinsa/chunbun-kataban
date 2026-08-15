import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Paperclip } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import apiClient from '../api/client'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import './SupportConversation.css'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const fetchDownload = async (url, name) => { const response = await apiClient.get(url, { responseType: 'blob' }); const link = URL.createObjectURL(response.data); const item = document.createElement('a'); item.href = link; item.download = name; item.click(); URL.revokeObjectURL(link) }

export default function SupportConversation() {
  const { ticketId } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [message, setMessage] = useState(''); const [file, setFile] = useState(null)
  const { data: ticket, isLoading } = useQuery({ queryKey: ['support-ticket', ticketId], queryFn: () => apiClient.get(`/support/tickets/${ticketId}`).then((response) => response.data), refetchInterval: 5000 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] })
  const reply = useMutation({ mutationFn: () => { const body = new FormData(); body.append('message', message); if (file) body.append('file', file); return apiClient.post(`/support/tickets/${ticketId}/replies`, body, { headers: { 'Content-Type': 'multipart/form-data' } }) }, onSuccess: () => { setMessage(''); setFile(null); refresh() } })
  const updateStatus = useMutation({ mutationFn: (status) => apiClient.put(`/support/tickets/${ticketId}`, { status }), onSuccess: refresh })
  if (isLoading) return <Spinner />
  if (!ticket) return <Button onClick={() => navigate('/support')}>Back to Support</Button>
  return <main className="admin-conversation-page"><header className="admin-conversation-header"><button onClick={() => navigate('/support')}><ArrowLeft size={17} /> Back to Support</button><span>SUPPORT CONVERSATION</span><h1>{ticket.subject}</h1><p>ARI{String(ticket.id).padStart(8, '0')} · {ticket.student_full_name}</p></header><section className="admin-conversation-thread"><article className="admin-request"><span>Student request</span><p>{ticket.description}</p>{ticket.attachment_name && <button onClick={() => fetchDownload(`/support/tickets/${ticket.id}/attachment`, ticket.attachment_name)}><Download size={14} /> {ticket.attachment_name}</button>}</article>{ticket.replies?.map((replyItem) => <article key={replyItem.id} className={`admin-message ${replyItem.sender_role === 'admin' ? 'is-admin' : 'is-student'}`}><div><strong>{replyItem.sender_role === 'admin' ? `${replyItem.sender_name ?? 'Admin'} (Admin)` : ticket.student_full_name}</strong><time>{new Date(replyItem.created_at).toLocaleString()}</time></div><p>{replyItem.message}</p>{replyItem.attachment_name && <button onClick={() => fetchDownload(`/support/tickets/${ticket.id}/replies/${replyItem.id}/attachment`, replyItem.attachment_name)}><Download size={13} /> {replyItem.attachment_name}</button>}</article>)}</section><section className="admin-reply"><textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a response to the student…" /><div><label><Paperclip size={15} />{file ? file.name : 'Attach file'}<input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><div className="admin-reply-actions"><Select value={ticket.status} onChange={(event) => updateStatus.mutate(event.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</Select><Button onClick={() => reply.mutate()} disabled={!message.trim() || reply.isPending}>Send Reply</Button></div></div></section></main>
}
