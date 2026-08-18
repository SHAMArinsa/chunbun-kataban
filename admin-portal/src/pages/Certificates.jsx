import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, Upload } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'

const EMPTY_FORM = { student_id: '', document_type: 'invoice', title: '', file: null }

export default function Certificates() {
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { data: documents, isLoading } = useQuery({ queryKey: ['student-documents'], queryFn: () => apiClient.get('/student-documents').then((r) => r.data) })
  const { data: students } = useQuery({ queryKey: ['students', 'document-upload'], queryFn: () => apiClient.get('/students', { params: { limit: 200 } }).then((r) => r.data) })

  const uploadMutation = useMutation({
    mutationFn: (values) => {
      const data = new FormData()
      data.append('student_id', values.student_id)
      data.append('document_type', values.document_type)
      data.append('title', values.title)
      data.append('file', values.file)
      return apiClient.post('/student-documents', data, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      push('Document uploaded and made available to the selected student.', 'success')
      queryClient.invalidateQueries({ queryKey: ['student-documents'] })
      setShowUpload(false)
      setForm(EMPTY_FORM)
    },
    onError: (error) => push(error.response?.data?.detail || 'Upload failed', 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/student-documents/${id}`),
    onSuccess: () => {
      push('Document removed.', 'success')
      queryClient.invalidateQueries({ queryKey: ['student-documents'] })
    },
    onError: (error) => push(error.response?.data?.detail || 'Could not remove document', 'error'),
  })
  const download = async (doc) => {
    const res = await apiClient.get(`/student-documents/${doc.id}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const link = window.document.createElement('a')
    link.href = url
    link.download = doc.file_name
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) return <Spinner />
  const canUpload = form.student_id && form.title.trim() && form.file
  const columns = [
    { key: 'student_name', header: 'Student', render: (row) => <div><p className="font-medium text-slate-900">{row.student_name}</p><p className="text-xs text-slate-500">{row.student_email}</p></div> },
    { key: 'document_type', header: 'Type', render: (row) => row.document_type.replace(/_/g, ' ') },
    { key: 'title', header: 'Title' },
    { key: 'uploaded_at', header: 'Uploaded', render: (row) => new Date(row.uploaded_at).toLocaleDateString() },
    { key: 'actions', header: '', render: (row) => <div className="flex gap-2"><Button variant="secondary" onClick={() => download(row)}><Download size={15} /> Download</Button><Button variant="danger" onClick={() => deleteMutation.mutate(row.id)} disabled={deleteMutation.isPending}><Trash2 size={15} /> Delete</Button></div> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-slate-900">Certificates &amp; Invoices</h1><p className="text-sm text-slate-500">Upload a final PDF for one student. It becomes visible only in that student's portal.</p></div><Button onClick={() => setShowUpload(true)}><Upload size={16} /> Upload document</Button></div>
      <Card><Table columns={columns} rows={documents} emptyMessage="No student documents uploaded yet." /></Card>
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Certificate or Invoice" footer={<Button onClick={() => uploadMutation.mutate(form)} disabled={!canUpload || uploadMutation.isPending}>Upload for student</Button>}>
        <div className="space-y-4">
          <Select label="Student" value={form.student_id} onChange={(e) => setForm((current) => ({ ...current, student_id: e.target.value }))}><option value="">Select student...</option>{students?.map((student) => <option key={student.id} value={student.id}>{student.full_name} ({student.email})</option>)}</Select>
          <Select label="Document type" value={form.document_type} onChange={(e) => setForm((current) => ({ ...current, document_type: e.target.value }))}><option value="invoice">Invoice</option><option value="welcome_certificate">Welcome Certificate</option><option value="certificate">Certificate</option></Select>
          <Input label="Document title" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="e.g. Basic Internship Welcome Certificate" />
          <label className="block text-sm font-medium text-slate-700">PDF file<input className="mt-1 block w-full text-sm" type="file" accept="application/pdf,.pdf" onChange={(e) => setForm((current) => ({ ...current, file: e.target.files?.[0] ?? null }))} /></label>
        </div>
      </Modal>
    </div>
  )
}
