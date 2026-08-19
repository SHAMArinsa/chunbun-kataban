import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Pencil, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'

const ENROLLMENT_STATUS_COLOR = {
  active: 'green', completed: 'blue', pending_payment: 'yellow', dropped: 'slate', suspended: 'red',
}

async function errorMessage(error, fallback) {
  const responseData = error.response?.data
  if (responseData instanceof Blob) {
    try {
      const body = JSON.parse(await responseData.text())
      return body.detail || fallback
    } catch {
      return fallback
    }
  }
  return responseData?.detail || fallback
}

export default function Students() {
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editingStudent, setEditingStudent] = useState(null) // { id, national_id_type, national_id_number, national_id_document_front_name, national_id_document_back_name }
  const frontFileInputRef = useRef(null)
  const backFileInputRef = useRef(null)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: students, isLoading } = useQuery({
    queryKey: ['students', search, startDate, endDate],
    queryFn: () => apiClient.get('/students', { params: { search: search || undefined, start_date: startDate || undefined, end_date: endDate || undefined, limit: 100 } }).then((r) => r.data),
  })

  const invalidateAndClose = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] })
    setEditingStudent(null)
  }

  const statusMutation = useMutation({
    mutationFn: ({ enrollmentId, newStatus }) => apiClient.put(`/enrollments/${enrollmentId}/status`, null, { params: { new_status: newStatus } }),
    onSuccess: (_res, { newStatus }) => {
      push(`Student ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.`, 'success')
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Update failed', 'error'),
  })

  const nationalIdMutation = useMutation({
    mutationFn: ({ studentId, national_id_type, national_id_number }) =>
      apiClient.put(`/students/${studentId}`, { national_id_type: national_id_type || null, national_id_number: national_id_number || null }),
    onSuccess: () => { push('National ID updated.', 'success'); invalidateAndClose() },
    onError: (err) => push(err.response?.data?.detail || 'Update failed', 'error'),
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ studentId, side, file }) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiClient.post(`/students/${studentId}/national-id-document/${side}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res, { side }) => {
      push('Document uploaded.', 'success')
      const nameField = side === 'front' ? 'national_id_document_front_name' : 'national_id_document_back_name'
      setEditingStudent((s) => (s ? { ...s, [nameField]: res.data[nameField] } : s))
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Upload failed', 'error'),
  })

  const downloadDocument = async (studentId, side, fileName) => {
    try {
      const res = await apiClient.get(`/students/${studentId}/national-id-document/${side}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || `id-document-${side}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      push(await errorMessage(err, 'Could not download this ID document'), 'error')
    }
  }

  const downloadExport = () => {
    try {
      const exportRows = (students ?? []).map((student) => ({
        'Student ID': student.id,
        Name: student.full_name,
        Email: student.email,
        Phone: student.phone || '',
        'Date of Birth': student.dob || '',
        Gender: student.gender || '',
        Address: student.address || '',
        City: student.city || '',
        State: student.state || '',
        Country: student.country || '',
        Citizenship: student.citizenship_status || '',
        Institution: student.institution || '',
        Degree: student.degree || '',
        'Graduation Year': student.graduation_year || '',
        GitHub: student.github_url || '',
        LinkedIn: student.linkedin_url || '',
        'National ID Type': student.national_id_type || '',
        'National ID Number': student.national_id_number || '',
        Program: student.program_name || '',
        'Enrollment Status': student.enrollment_status || '',
        'Start Date': student.enrollment_start_date || '',
        'End Date': student.enrollment_end_date || '',
        'Joined Date': student.created_at ? new Date(student.created_at).toLocaleDateString() : '',
      }))
      const sheet = XLSX.utils.json_to_sheet(exportRows)
      sheet['!cols'] = [
        { wch: 12 }, { wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 18 },
        { wch: 14 }, { wch: 14 }, { wch: 14 },
      ]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Students')
      XLSX.writeFile(workbook, 'students-export.xlsx', { compression: true })
    } catch (err) {
      push('Could not export students', 'error')
    }
  }

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'full_name', header: 'Name' },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
    { key: 'citizenship_status', header: 'Citizenship', render: (r) => <Badge color={r.citizenship_status === 'indian' ? 'blue' : 'yellow'}>{r.citizenship_status}</Badge> },
    { key: 'country', header: 'Country', render: (r) => r.country || '—' },
    {
      key: 'national_id',
      header: 'ID Document',
      render: (r) => (
        <button
          className="flex items-center gap-1 text-left text-slate-700 hover:text-brand-600"
          onClick={() =>
            setEditingStudent({
              id: r.id,
              national_id_type: r.national_id_type || '',
              national_id_number: r.national_id_number || '',
              national_id_document_front_name: r.national_id_document_front_name || null,
              national_id_document_back_name: r.national_id_document_back_name || null,
            })
          }
        >
          <span>
            {r.national_id_type
              ? <>{r.national_id_type} → {r.national_id_number || '—'}</>
              : <span className="text-slate-400">Not provided</span>}
          </span>
          <Pencil size={12} className="shrink-0 text-slate-400" />
        </button>
      ),
    },
    { key: 'program_name', header: 'Program', render: (r) => r.program_name ?? '—' },
    {
      key: 'enrollment_status',
      header: 'Status',
      render: (r) =>
        r.enrollment_status ? (
          <div className="flex flex-col gap-0.5">
            <Badge color={ENROLLMENT_STATUS_COLOR[r.enrollment_status] ?? 'slate'}>{r.enrollment_status.replace('_', ' ')}</Badge>
            {r.enrollment_status === 'suspended' && r.enrollment_suspension_reason && (
              <span className="max-w-[220px] text-[11px] leading-tight text-red-600" title={r.enrollment_suspension_reason}>
                {r.enrollment_suspension_reason}
              </span>
            )}
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'enrollment_start_date', header: 'Start Date', render: (r) => (r.enrollment_start_date ? new Date(r.enrollment_start_date).toLocaleDateString() : '—') },
    { key: 'enrollment_end_date', header: 'End Date', render: (r) => (r.enrollment_end_date ? new Date(r.enrollment_end_date).toLocaleDateString() : '—') },
    { key: 'created_at', header: 'Joined', render: (r) => new Date(r.created_at).toLocaleDateString() },
    {
      key: 'action',
      header: '',
      render: (r) => {
        if (!r.enrollment_id) return null
        const isSuspended = r.enrollment_status === 'suspended'
        return (
          <Button
            variant={isSuspended ? 'secondary' : 'danger'}
            onClick={() => statusMutation.mutate({ enrollmentId: r.enrollment_id, newStatus: isSuspended ? 'active' : 'suspended' })}
            disabled={statusMutation.isPending}
          >
            {isSuspended ? 'Reactivate' : 'Suspend'}
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs"><Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="w-full max-w-[190px]"><Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="w-full max-w-[190px]"><Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <Button variant="secondary" onClick={downloadExport} disabled={isLoading}><Download size={15} /> Download XLSX</Button>
      </div>
      <Card>{isLoading ? <Spinner /> : <Table columns={columns} rows={students} emptyMessage="No students found." />}</Card>

      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title="National ID Document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingStudent(null)}>Cancel</Button>
            <Button
              onClick={() => nationalIdMutation.mutate({ studentId: editingStudent.id, ...editingStudent })}
              disabled={nationalIdMutation.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        {editingStudent && (
          <div className="space-y-4">
            <Input
              label="Document Type"
              value={editingStudent.national_id_type}
              onChange={(e) => setEditingStudent((s) => ({ ...s, national_id_type: e.target.value }))}
              placeholder="e.g. PAN, Aadhar, Passport"
            />
            <Input
              label="Document Number"
              value={editingStudent.national_id_number}
              onChange={(e) => setEditingStudent((s) => ({ ...s, national_id_number: e.target.value }))}
              placeholder="e.g. ABCDE1234F"
            />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">ID Document (Front Side)</span>
              <div className="flex items-center gap-2">
                <input
                  ref={frontFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadDocumentMutation.mutate({ studentId: editingStudent.id, side: 'front', file })
                    e.target.value = ''
                  }}
                />
                {editingStudent.national_id_document_front_name && (
                  <Button
                    variant="secondary"
                    onClick={() => downloadDocument(editingStudent.id, 'front', editingStudent.national_id_document_front_name)}
                  >
                    <Download size={15} /> {editingStudent.national_id_document_front_name}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => frontFileInputRef.current?.click()}
                  disabled={uploadDocumentMutation.isPending}
                >
                  <Upload size={15} /> {editingStudent.national_id_document_front_name ? 'Replace' : 'Upload'}
                </Button>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">ID Document (Back Side)</span>
              <div className="flex items-center gap-2">
                <input
                  ref={backFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadDocumentMutation.mutate({ studentId: editingStudent.id, side: 'back', file })
                    e.target.value = ''
                  }}
                />
                {editingStudent.national_id_document_back_name && (
                  <Button
                    variant="secondary"
                    onClick={() => downloadDocument(editingStudent.id, 'back', editingStudent.national_id_document_back_name)}
                  >
                    <Download size={15} /> {editingStudent.national_id_document_back_name}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => backFileInputRef.current?.click()}
                  disabled={uploadDocumentMutation.isPending}
                >
                  <Upload size={15} /> {editingStudent.national_id_document_back_name ? 'Replace' : 'Upload'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
