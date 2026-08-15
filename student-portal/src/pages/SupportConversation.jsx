import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Paperclip } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import './SupportConversation.css'

const ticketNumber = (id) => `ARI${String(id).padStart(8, '0')}`
const download = async (url, fileName) => { const response = await apiClient.get(url, { responseType: 'blob' }); const href = URL.createObjectURL(response.data); const anchor = document.createElement('a'); anchor.href = href; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(href) }

export default function SupportConversation() {
  const { ticketId } = useParams(); const navigate = useNavigate(); const { push } = useToast(); const queryClient = useQueryClient()
  const [message, setMessage] = useState(''); const [file, setFile] = useState(null)
  const { data: tickets, isLoading } = useQuery({ queryKey: ['tickets', 'me'], queryFn: () => apiClient.get('/support/tickets/me').then((response) => response.data), refetchInterval: 5000 })
  const ticket = tickets?.find((item) => String(item.id) === ticketId)
  const reply = useMutation({ mutationFn: () => { const body = new FormData(); body.append('message', message); if (file) body.append('file', file); return apiClient.post(`/support/tickets/${ticketId}/replies`, body, { headers: { 'Content-Type': 'multipart/form-data' } }) }, onSuccess: () => { setMessage(''); setFile(null); queryClient.invalidateQueries({ queryKey: ['tickets'] }) }, onError: (error) => push(error.response?.data?.detail || 'Reply failed', 'error') })
  if (isLoading) return <Spinner />
  if (!ticket) return <div className="support-conversation-empty"><p>That support request could not be found.</p><Button onClick={() => navigate('/support')}>Back to Support</Button></div>
  return <main className="support-conversation-page">
    <header className="support-conversation-header"><button className="support-back" onClick={() => navigate('/support')}><ArrowLeft size={17} /> Back to Support</button><div><span>SUPPORT CONVERSATION</span><h1>{ticket.subject}</h1><p>{ticketNumber(ticket.id)}</p></div></header>
    <section className="support-conversation-thread"><article className="conversation-request"><span>Your request</span><p>{ticket.description}</p>{ticket.attachment_name && <button onClick={() => download(`/support/tickets/${ticket.id}/attachment`, ticket.attachment_name)}><Download size={14} /> {ticket.attachment_name}</button>}</article>{ticket.replies?.map((item) => <article key={item.id} className={`conversation-message ${item.sender_role === 'admin' ? 'is-support' : 'is-student'}`}><div><strong>{item.sender_role === 'admin' ? `${item.sender_name ?? 'Support'} (Support)` : 'You'}</strong><time>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.message}</p>{item.attachment_name && <button onClick={() => download(`/support/tickets/${ticket.id}/replies/${item.id}/attachment`, item.attachment_name)}><Download size={13} /> {item.attachment_name}</button>}</article>)}</section>
    {ticket.status !== 'closed' && <section className="support-reply"><textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your reply…" /><div><label><Paperclip size={15} />{file ? file.name : 'Attach file'}<input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><Button onClick={() => reply.mutate()} disabled={!message.trim() || reply.isPending}>Send reply</Button></div></section>}
  </main>
}
