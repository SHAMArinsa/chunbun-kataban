import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

const EMPTY_FORM = { domain_id: '', title: '', instructor_name: '', meet_link: '', scheduled_date: '', start_time: '', end_time: '', description: '' }

const DOMAIN_LABEL = {
  python: 'Python Programming',
  web_dev: 'Web Development',
  database: 'Database',
  ai: 'Artificial Intelligence',
  genai: 'Generative AI',
  software_engineering: 'Software Engineering',
}

function ClassFormFields({ form, setForm, domains }) {
  return (
    <div className="space-y-4">
      <Select label="Domain (optional)" value={form.domain_id} onChange={(e) => setForm((f) => ({ ...f, domain_id: e.target.value }))}>
        <option value="">— Not domain-specific —</option>
        {domains?.map((d) => (
          <option key={d.id} value={d.id}>{DOMAIN_LABEL[d.name] ?? d.name}</option>
        ))}
      </Select>
      <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <Input label="Instructor Name" value={form.instructor_name} onChange={(e) => setForm((f) => ({ ...f, instructor_name: e.target.value }))} />
      <Input label="Google Meet Link" value={form.meet_link} onChange={(e) => setForm((f) => ({ ...f, meet_link: e.target.value }))} placeholder="https://meet.google.com/xxx-yyyy-zzz" />
      <Input label="Date" type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
        <Input label="End Time" type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
      </div>
    </div>
  )
}

export default function LiveClasses() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [deleting, setDeleting] = useState(null)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: classes, isLoading } = useQuery({
    queryKey: ['live-classes'],
    queryFn: () => apiClient.get('/live-classes').then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  const platinumProgram = programs?.find((p) => p.code === 'platinum')
  const domainName = (domainId) => {
    const d = platinumProgram?.domains?.find((d) => d.id === domainId)
    return d ? DOMAIN_LABEL[d.name] ?? d.name : '—'
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['live-classes'] })

  const createMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/live-classes', payload),
    onSuccess: () => {
      push('Live class scheduled — visible to all active Platinum students.', 'success')
      invalidate()
      setShowForm(false)
      setForm(EMPTY_FORM)
    },
    onError: (err) => push(err.response?.data?.detail || 'Failed to schedule', 'error'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, payload }) => apiClient.put(`/live-classes/${id}`, payload),
    onSuccess: () => {
      push('Live class updated.', 'success')
      invalidate()
      setEditing(null)
    },
    onError: (err) => push(err.response?.data?.detail || 'Update failed', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/live-classes/${id}`),
    onSuccess: () => {
      push('Live class deleted.', 'success')
      invalidate()
      setDeleting(null)
    },
    onError: (err) => push(err.response?.data?.detail || 'Delete failed', 'error'),
  })

  const startEdit = (r) => {
    setEditing(r)
    setEditForm({
      domain_id: r.domain_id ?? '',
      title: r.title,
      instructor_name: r.instructor_name,
      meet_link: r.meet_link,
      scheduled_date: r.scheduled_date,
      start_time: r.start_time?.slice(0, 5) ?? '',
      end_time: r.end_time?.slice(0, 5) ?? '',
      description: r.description ?? '',
    })
  }

  const handleSchedule = () => {
    createMutation.mutate({
      ...form,
      program_id: platinumProgram.id,
      domain_id: form.domain_id ? Number(form.domain_id) : null,
    })
  }

  const handleSaveEdit = () => {
    editMutation.mutate({
      id: editing.id,
      payload: { ...editForm, domain_id: editForm.domain_id ? Number(editForm.domain_id) : null },
    })
  }

  if (isLoading) return <Spinner />

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'domain_id', header: 'Domain', render: (r) => domainName(r.domain_id) },
    { key: 'instructor_name', header: 'Instructor' },
    { key: 'scheduled_date', header: 'Date' },
    { key: 'time', header: 'Time', render: (r) => `${r.start_time}–${r.end_time}` },
    { key: 'status', header: 'Status', render: (r) => <Badge color={r.status === 'scheduled' ? 'blue' : r.status === 'completed' ? 'green' : 'red'}>{r.status}</Badge> },
    {
      key: 'action',
      header: '',
      render: (r) => (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => startEdit(r)}>Edit</Button>
          <Button variant="danger" onClick={() => setDeleting(r)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Live Classes</h1>
          <p className="text-sm text-slate-500">Platinum Program only — Phase 1 live sessions via Google Meet.</p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={!platinumProgram}>Schedule Class</Button>
      </div>

      <Card><Table columns={columns} rows={classes} emptyMessage="No live classes scheduled yet." /></Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Schedule Live Class — Platinum Program"
        footer={<Button onClick={handleSchedule} disabled={createMutation.isPending}>Schedule</Button>}
      >
        <ClassFormFields form={form} setForm={setForm} domains={platinumProgram?.domains} />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit Live Class — ${editing?.title ?? ''}`}
        footer={<Button onClick={handleSaveEdit} disabled={editMutation.isPending}>Save Changes</Button>}
      >
        <ClassFormFields form={editForm} setForm={setEditForm} domains={platinumProgram?.domains} />
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete Live Class"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete <strong>{deleting?.title}</strong>? This removes it from every enrolled Platinum student's Live
          Classes immediately and cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
