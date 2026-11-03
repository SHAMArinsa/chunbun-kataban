import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Lock, MessageSquare, Send, X } from 'lucide-react'
import apiClient from '../../api/client'
import { useToast } from '../../context/ToastContext'

/* Chat-style feedback thread (text + images). Identical file in admin-portal and student-portal. */

const MAX_MB = 10
const fmtTime = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const errText = (e) => e?.response?.data?.detail || e?.message || 'Something went wrong'

function AuthImage({ url, alt, onOpen, onLoad }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let u, alive = true
    apiClient.get(url, { responseType: 'blob' }).then((r) => { if (alive) { u = URL.createObjectURL(r.data); setSrc(u) } }).catch(() => {})
    return () => { alive = false; if (u) URL.revokeObjectURL(u) }
  }, [url])
  if (!src) return <div className="h-40 w-56 animate-pulse rounded-lg bg-slate-200/70" />
  return <img src={src} alt={alt} onLoad={onLoad} onClick={() => onOpen(src)} className="max-h-56 max-w-full cursor-zoom-in rounded-lg border border-black/5 object-contain" />
}

export default function FeedbackChat({ listUrl, postUrl, me, queryKey, title = 'Feedback conversation', emptyText, className = '', height = 'max-h-96', disabled = false, disabledText = '' }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [zoom, setZoom] = useState(null)
  const fileRef = useRef(null)
  const boxRef = useRef(null)
  const toBottom = () => { const b = boxRef.current; if (b) b.scrollTop = b.scrollHeight }
  const { data: msgs = [], isLoading } = useQuery({ queryKey, queryFn: () => apiClient.get(listUrl).then((r) => r.data), refetchInterval: 20000 })

  useEffect(() => { toBottom() }, [msgs.length])
  const unread = msgs.filter((m) => m.sender_role !== me && !m.read_at).length
  useEffect(() => { if (me === 'student' && unread) qc.invalidateQueries({ queryKey: ['v2', 'work'] }) }, [me, unread, qc])
  useEffect(() => {
    if (!image) { setPreview(null); return undefined }
    const u = URL.createObjectURL(image); setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [image])

  const pick = (f) => {
    if (!f) return
    if (!/^image\/(png|jpe?g)$/.test(f.type)) { push('Only PNG or JPG images can be attached.', 'error'); return }
    if (f.size > MAX_MB * 1048576) { push(`Image is too large (max ${MAX_MB} MB).`, 'error'); return }
    setImage(f)
  }
  const send = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (text.trim()) fd.append('body', text.trim())
      if (image) fd.append('image', image, image.name || 'screenshot.png')
      return apiClient.post(postUrl, fd)
    },
    onSuccess: () => { setText(''); setImage(null); qc.invalidateQueries({ queryKey }); qc.invalidateQueries({ queryKey: ['v2', 'work'] }) },
    onError: (e) => push(errText(e), 'error'),
  })
  const canSend = (text.trim() || image) && !send.isPending
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) send.mutate() } }
  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
    if (item) { e.preventDefault(); pick(item.getAsFile()) }
  }

  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <header className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2583D8] to-[#0B2E59] text-white"><MessageSquare size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${disabled ? 'bg-slate-400' : 'bg-emerald-500'}`} />
            {disabled ? 'Read-only' : 'Open'}{msgs.length > 0 && <> · {msgs.length} message{msgs.length === 1 ? '' : 's'}</>}
          </p>
        </div>
      </header>

      <div ref={boxRef} style={{ maxHeight: 440, minHeight: 140, overflowY: 'auto', overscrollBehavior: 'contain' }} className="flex-1 space-y-3 bg-[#F5F9FE] px-4 py-4">
        {isLoading && <p className="text-center text-xs text-slate-400">Loading…</p>}
        {!isLoading && msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand-600 shadow-sm"><MessageSquare size={20} /></span><p className="max-w-[240px] text-sm text-slate-500">{emptyText || 'No messages yet.'}</p></div>
        )}
        {msgs.map((m) => {
          const mine = m.sender_role === me
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                <p className={`mb-0.5 px-1 text-[11px] text-slate-500 ${mine ? 'text-right' : ''}`}>
                  <b className="font-medium text-slate-700">{mine ? 'You' : m.sender_name}</b>
                  {m.sender_role === 'staff' && !mine && <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] font-semibold text-brand-700">Reviewer</span>}
                  {' · '}{fmtTime(m.created_at)}
                </p>
                <div className={`space-y-2 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${mine ? 'rounded-br-md bg-gradient-to-br from-[#2583D8] to-[#1254A6] text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>
                  {m.image_url && <AuthImage url={m.image_url} alt={m.image_name || 'attachment'} onOpen={setZoom} onLoad={toBottom} />}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {disabled ? (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-500"><Lock size={14} className="shrink-0 text-slate-400" /> {disabledText || 'Messaging is not available right now.'}</div>
      ) : (
      <div className="border-t border-slate-100 p-3">
        {preview && (
          <div className="relative mb-2 inline-block">
            <img src={preview} alt="Attachment preview" className="h-20 rounded-lg border border-slate-200 object-cover" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove image" className="absolute -right-2 -top-2 rounded-full bg-slate-800 p-0.5 text-white shadow"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} title="Attach image (or paste a screenshot)" aria-label="Attach image"
            className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700">
            <ImagePlus size={18} />
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" data-testid="chat-image"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
          <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onPaste={onPaste}
            placeholder="Type a message…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:bg-white focus:outline-none" />
          <button type="button" disabled={!canSend} onClick={() => send.mutate()} aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Full size" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute right-5 top-5 rounded-full bg-white/90 p-1.5" aria-label="Close"><X size={18} /></button>
        </div>
      )}
    </section>
  )
}
