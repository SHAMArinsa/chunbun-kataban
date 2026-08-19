import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FilePlus2 } from 'lucide-react'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'

const DOCUMENT_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'welcome_certificate', label: 'Welcome Certificate' },
  { value: 'internship_certificate', label: 'Internship Certificate' },
]

function fallbackFilename(type, student, program) {
  const part = (value) => (value || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${type}_${part(student?.full_name)}_${part(program)}.pdf`
}

export default function GenerateDocuments() {
  const { push } = useToast()
  const [studentSearch, setStudentSearch] = useState('')
  const [studentId, setStudentId] = useState('')
  const [documentType, setDocumentType] = useState('invoice')
  const [templateMode, setTemplateMode] = useState('default')
  const [templateId, setTemplateId] = useState('')
  const [templateFile, setTemplateFile] = useState(null)
  const [result, setResult] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'document-generator'],
    queryFn: () => apiClient.get('/students', { params: { limit: 200 } }).then((response) => response.data),
  })
  const { data: templates } = useQuery({
    queryKey: ['document-generator-templates'],
    queryFn: () => apiClient.get('/document-generator/templates').then((response) => response.data),
  })

  const matchingStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return students || []
    return (students || []).filter((student) => `${student.full_name} ${student.email}`.toLowerCase().includes(query))
  }, [students, studentSearch])
  const selectedStudent = (students || []).find((student) => String(student.id) === studentId)
  const typeTemplates = (templates || []).filter((template) => template.document_type === documentType)
  const defaultTemplateId = typeTemplates[0]?.id || ''

  useEffect(() => {
    setTemplateId(defaultTemplateId)
    setTemplateFile(null)
  }, [documentType, defaultTemplateId])

  useEffect(() => () => {
    if (result?.url) window.URL.revokeObjectURL(result.url)
  }, [result])

  const generate = async () => {
    if (!studentId) {
      push('Select a student first.', 'error')
      return
    }
    if (templateMode === 'custom' && !templateFile) {
      push('Choose a PDF template first.', 'error')
      return
    }
    setIsGenerating(true)
    try {
      const data = new FormData()
      data.append('student_id', studentId)
      data.append('document_type', documentType)
      data.append('template_id', templateId)
      if (templateMode === 'custom') data.append('template_file', templateFile)
      const response = await apiClient.post('/document-generator/generate', data, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const filename = response.headers['x-generated-filename'] || fallbackFilename(documentType, selectedStudent, selectedStudent?.program_name)
      setResult((previous) => {
        if (previous?.url) window.URL.revokeObjectURL(previous.url)
        return { url, filename }
      })
      push('Document generated. Review it below before downloading.', 'success')
    } catch (error) {
      const body = error.response?.data
      if (body instanceof Blob) {
        try {
          const parsed = JSON.parse(await body.text())
          push(parsed.detail || 'Could not generate document', 'error')
        } catch {
          push('Could not generate document', 'error')
        }
      } else {
        push(body?.detail || 'Could not generate document', 'error')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const download = () => {
    if (!result) return
    const link = window.document.createElement('a')
    link.href = result.url
    link.download = result.filename
    link.click()
  }

  if (studentsLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Generate Certificate &amp; Invoice</h1>
        <p className="mt-1 text-sm text-slate-500">Create a PDF from the selected student’s saved enrollment and payment data. Generation does not publish the document to the student portal.</p>
      </div>

      <Card className="max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input label="Search student" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search by student name or email..." />
          </div>
          <Select label="Student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Select student...</option>
            {matchingStudents.map((student) => <option key={student.id} value={student.id}>{student.full_name} ({student.email})</option>)}
          </Select>
          <Select label="Document to generate" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
          <Select label="Template source" value={templateMode} onChange={(event) => setTemplateMode(event.target.value)}>
            <option value="default">Use an existing empty template</option>
            <option value="custom">Upload a new fillable PDF template</option>
          </Select>
          {templateMode === 'default' ? (
            <Select label="Existing template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {typeTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </Select>
          ) : (
            <label className="block text-sm font-medium text-slate-700">New PDF template
              <input className="mt-1 block w-full text-sm" type="file" accept="application/pdf,.pdf" onChange={(event) => setTemplateFile(event.target.files?.[0] || null)} />
            </label>
          )}
        </div>

        {templateMode === 'custom' && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Custom templates must be fillable PDFs. Supported field names: <code>student_name</code>, <code>program_name</code>, <code>student_id</code>, <code>enrollment_date</code>, <code>program_duration</code>, <code>start_date</code>, <code>date_of_issue</code>, <code>invoice_number</code>, and <code>amount</code>.</p>
        )}
        <div className="mt-5 flex justify-end"><Button onClick={generate} disabled={isGenerating || !studentId}><FilePlus2 size={16} /> {isGenerating ? 'Generating...' : 'Generate document'}</Button></div>
      </Card>

      {result && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Generated preview</h2><p className="text-sm text-slate-500">Review the PDF, then download it when ready.</p></div><Button variant="secondary" onClick={download}><Download size={16} /> Download PDF</Button></div>
          <iframe title="Generated document preview" src={result.url} className="h-[75vh] w-full rounded-md border border-slate-200 bg-slate-100" />
        </Card>
      )}
    </div>
  )
}
