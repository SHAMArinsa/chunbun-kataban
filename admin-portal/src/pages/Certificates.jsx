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

const CERT_TYPES = ['internship_completion', 'project_completion', 'performance_evaluation', 'recommendation', 'platinum', 'experience']

export default function Certificates() {
  const [showGenerate, setShowGenerate] = useState(false)
  const [form, setForm] = useState({ student_id: '', enrollment_id: '', certificate_type: 'internship_completion' })
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: certificates, isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => apiClient.get('/certificates').then((r) => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/certificates', payload),
    onSuccess: () => {
      push('Certificate generated!', 'success')
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
      setShowGenerate(false)
    },
    onError: (err) => push(err.response?.data?.detail || 'Generation failed', 'error'),
  })

  const download = async (id, num) => {
    const res = await apiClient.get(`/certificates/${id}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${num}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) return <Spinner />

  const columns = [
    { key: 'certificate_number', header: 'Certificate No.' },
    { key: 'student_id', header: 'Student ID' },
    { key: 'certificate_type', header: 'Type', render: (r) => r.certificate_type.replace(/_/g, ' ') },
    { key: 'issued_date', header: 'Issued' },
    { key: 'action', header: '', render: (r) => <Button variant="secondary" onClick={() => download(r.id, r.certificate_number)}>Download</Button> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Certificates</h1>
        <Button onClick={() => setShowGenerate(true)}>Generate Certificate</Button>
      </div>

      <Card><Table columns={columns} rows={certificates} emptyMessage="No certificates generated yet." /></Card>

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Certificate" footer={<Button onClick={() => generateMutation.mutate({ student_id: Number(form.student_id), enrollment_id: Number(form.enrollment_id), certificate_type: form.certificate_type })} disabled={generateMutation.isPending}>Generate</Button>}>
        <div className="space-y-4">
          <Input label="Student ID" type="number" value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))} />
          <Input label="Enrollment ID" type="number" value={form.enrollment_id} onChange={(e) => setForm((f) => ({ ...f, enrollment_id: e.target.value }))} />
          <Select label="Certificate Type" value={form.certificate_type} onChange={(e) => setForm((f) => ({ ...f, certificate_type: e.target.value }))}>
            {CERT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
