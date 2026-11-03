import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Table from '../../components/ui/Table'
import { PageHeader, TextArea } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { TIERS, errorText, fmtDateTime } from '../../lib/v2'

export default function Announcements() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [f, setF] = useState({ audience: 'all', title: '', message: '' })
  const [studentSearch, setStudentSearch] = useState('')
  const { data } = useQuery({ queryKey: ['v2', 'announcements'], queryFn: () => apiClient.get('/v2/staff/announcements').then((r) => r.data) })
  const { data: matches } = useQuery({
    queryKey: ['academic-students', studentSearch], enabled: f.audience === 'student' && studentSearch.length > 1,
    queryFn: () => apiClient.get('/academic/students', { params: { search: studentSearch } }).then((r) => r.data),
  })
  const send = useMutation({
    mutationFn: () => apiClient.post('/v2/staff/announcements', { ...f, student_id: f.student_id ? Number(f.student_id) : null }),
    onSuccess: () => { push('Announcement sent', 'success'); setF({ audience: f.audience, title: '', message: '' }); qc.invalidateQueries({ queryKey: ['v2', 'announcements'] }) },
    onError: (e) => push(errorText(e), 'error'),
  })
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications & Announcements" />
      <Card className="space-y-3 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Send to" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value, student_id: null })}>
            <option value="all">All students</option>
            {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label} students</option>)}
            <option value="student">An individual student</option>
          </Select>
          {f.audience === 'student' && (
            <div>
              <Input label="Find student" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Type a name…" />
              <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={f.student_id || ''} onChange={(e) => setF({ ...f, student_id: e.target.value })}>
                <option value="">— choose —</option>
                {(matches || []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}
        </div>
        <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <TextArea label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        <Button disabled={!f.title || !f.message || send.isPending || (f.audience === 'student' && !f.student_id)} onClick={() => send.mutate()}>Send announcement</Button>
      </Card>
      <Card>
        <Table rows={data} emptyMessage="No announcements yet." columns={[
          { key: 'created_at', header: 'Sent', render: (r) => fmtDateTime(r.created_at) },
          { key: 'audience', header: 'Audience' }, { key: 'title', header: 'Title' },
          { key: 'message', header: 'Message', render: (r) => <span className="line-clamp-1 max-w-md whitespace-normal">{r.message}</span> },
        ]} />
      </Card>
    </div>
  )
}
