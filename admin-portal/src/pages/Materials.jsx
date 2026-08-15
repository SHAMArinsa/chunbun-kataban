import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import FileUpload from '../components/ui/FileUpload'
import Modal from '../components/ui/Modal'
import Table from '../components/ui/Table'

export default function Materials() {
  const [activeProgramId, setActiveProgramId] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', week_number: '' })
  const [file, setFile] = useState(null)
  const [replacing, setReplacing] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  useEffect(() => {
    if (!activeProgramId && programs?.length) setActiveProgramId(programs[0].id)
  }, [programs, activeProgramId])

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials', activeProgramId],
    queryFn: () => apiClient.get('/materials', { params: { program_id: activeProgramId } }).then((r) => r.data),
    enabled: !!activeProgramId,
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => apiClient.post('/materials', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      push('Material uploaded and made available to students on this plan!', 'success')
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      setShowUpload(false)
      setForm({ title: '', description: '', week_number: '' })
      setFile(null)
    },
    onError: (err) => push(err.response?.data?.detail || 'Upload failed', 'error'),
  })

  const replaceMutation = useMutation({
    mutationFn: ({ id, formData }) => apiClient.put(`/materials/${id}/replace-file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      push('Material file replaced!', 'success')
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      setReplacing(null)
      setReplaceFile(null)
    },
    onError: (err) => push(err.response?.data?.detail || 'Replace failed', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/materials/${id}`),
    onSuccess: () => {
      push('Material deleted.', 'success')
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      setDeleting(null)
    },
    onError: (err) => push(err.response?.data?.detail || 'Delete failed', 'error'),
  })

  const handleUpload = () => {
    const formData = new FormData()
    formData.append('title', form.title)
    if (form.description) formData.append('description', form.description)
    formData.append('program_id', activeProgramId)
    if (form.week_number) formData.append('week_number', form.week_number)
    formData.append('file', file)
    uploadMutation.mutate(formData)
  }

  const handleReplace = () => {
    const formData = new FormData()
    formData.append('file', replaceFile)
    replaceMutation.mutate({ id: replacing.id, formData })
  }

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'file_type', header: 'Type', render: (r) => r.file_type.toUpperCase() },
    { key: 'week_number', header: 'Week', render: (r) => r.week_number ?? '—' },
    { key: 'created_at', header: 'Uploaded', render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: 'updated_at', header: 'Last Updated', render: (r) => new Date(r.updated_at).toLocaleString() },
    {
      key: 'action',
      header: '',
      render: (r) => (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setReplacing(r); setReplaceFile(null) }}>
            Replace File
          </Button>
          <Button variant="danger" onClick={() => setDeleting(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const activeProgram = programs?.find((p) => p.id === activeProgramId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Learning Materials</h1>
        <Button onClick={() => setShowUpload(true)} disabled={!activeProgramId}>Upload Material</Button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {programs?.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProgramId(p.id)}
            className={`px-4 py-2 text-sm font-medium ${activeProgramId === p.id ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table columns={columns} rows={materials} emptyMessage={`No materials uploaded for ${activeProgram?.name ?? 'this plan'} yet.`} />
        )}
      </Card>

      <Modal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title={`Upload Material — ${activeProgram?.name ?? ''}`}
        footer={<Button onClick={handleUpload} disabled={!form.title || !file || uploadMutation.isPending}>Upload</Button>}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            This material will be immediately visible to all actively-enrolled <strong>{activeProgram?.name}</strong> students.
          </p>
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Week Number (optional)" type="number" value={form.week_number} onChange={(e) => setForm((f) => ({ ...f, week_number: e.target.value }))} />
          <FileUpload label="File" onChange={setFile} fileName={file?.name} />
        </div>
      </Modal>

      <Modal
        open={!!replacing}
        onClose={() => setReplacing(null)}
        title={`Replace File — ${replacing?.title ?? ''}`}
        footer={<Button onClick={handleReplace} disabled={!replaceFile || replaceMutation.isPending}>Replace</Button>}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Uploads a new PDF/DOCX/ZIP/image in place of the current file. Title, description, and week stay the
            same unless you change them below — students keep seeing the same material entry with updated content.
          </p>
          <FileUpload label="New File" onChange={setReplaceFile} fileName={replaceFile?.name} />
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete Material"
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
          Delete <strong>{deleting?.title}</strong>? This removes it from every enrolled student's Learning
          Materials immediately and cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
