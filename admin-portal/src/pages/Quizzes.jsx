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
import Badge from '../components/ui/Badge'
import FileUpload from '../components/ui/FileUpload'

const EMPTY_QUIZ = { title: '', program_id: '', domain_id: '', question_bank_size: 200, questions_per_attempt: 20, passing_percent: 80, max_attempts: 5, attempts_per_day: 1, time_limit_minutes: 30 }
const EMPTY_QUESTION = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }

export default function Quizzes({ platinumOnly = false }) {
  const [showCreate, setShowCreate] = useState(false)
  const [quizForm, setQuizForm] = useState(EMPTY_QUIZ)
  const [managingQuiz, setManagingQuiz] = useState(null)
  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION)
  const [showUploadSheet, setShowUploadSheet] = useState(false)
  const [sheetTitle, setSheetTitle] = useState('')
  const [sheetFile, setSheetFile] = useState(null)
  const [assigningSheet, setAssigningSheet] = useState(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const { push } = useToast()
  const queryClient = useQueryClient()

  const isDomainQuiz = !!managingQuiz?.domain_id

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => apiClient.get('/quizzes').then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })
  const { data: questions } = useQuery({
    queryKey: ['quiz-questions', managingQuiz?.id],
    queryFn: () => apiClient.get(`/quizzes/${managingQuiz.id}/questions`).then((r) => r.data),
    enabled: !!managingQuiz && !isDomainQuiz,
  })
  const { data: sheets } = useQuery({
    queryKey: ['quiz-sheets', managingQuiz?.id],
    queryFn: () => apiClient.get(`/quizzes/${managingQuiz.id}/sheets`).then((r) => r.data),
    enabled: !!managingQuiz && isDomainQuiz,
  })
  const platinumProgram = programs?.find((p) => p.code === 'platinum')
  const { data: platinumStudents } = useQuery({
    queryKey: ['students', 'program', platinumProgram?.id],
    queryFn: () => apiClient.get('/students', { params: { program_id: platinumProgram.id, limit: 200 } }).then((r) => r.data),
    enabled: !!assigningSheet && !!platinumProgram,
  })
  const { data: sheetAssignments } = useQuery({
    queryKey: ['sheet-assignments', assigningSheet?.id],
    queryFn: () => apiClient.get(`/quizzes/sheets/${assigningSheet.id}/assignments`).then((r) => r.data),
    enabled: !!assigningSheet,
  })

  const createQuizMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/quizzes', payload),
    onSuccess: () => {
      push('Quiz created!', 'success')
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      setShowCreate(false)
      setQuizForm(EMPTY_QUIZ)
    },
  })

  const addQuestionMutation = useMutation({
    mutationFn: (payload) => apiClient.post(`/quizzes/${managingQuiz.id}/questions`, payload),
    onSuccess: () => {
      push('Question added!', 'success')
      queryClient.invalidateQueries({ queryKey: ['quiz-questions', managingQuiz.id] })
      setQuestionForm(EMPTY_QUESTION)
    },
  })

  const uploadSheetMutation = useMutation({
    mutationFn: (formData) => apiClient.post(`/quizzes/${managingQuiz.id}/sheets`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res) => {
      push(`Sheet uploaded: ${res.data.rows_parsed} questions loaded${res.data.rows_skipped ? `, ${res.data.rows_skipped} rows skipped` : ''}.`, 'success')
      queryClient.invalidateQueries({ queryKey: ['quiz-sheets', managingQuiz.id] })
      setShowUploadSheet(false)
      setSheetTitle('')
      setSheetFile(null)
    },
    onError: (err) => push(err.response?.data?.detail || 'Upload failed', 'error'),
  })

  const assignSheetMutation = useMutation({
    mutationFn: () => apiClient.post(`/quizzes/sheets/${assigningSheet.id}/assign`, { student_ids: selectedStudentIds }),
    onSuccess: (res) => {
      push(`Assigned to ${res.data.newly_assigned} student(s).`, 'success')
      queryClient.invalidateQueries({ queryKey: ['quiz-sheets', managingQuiz?.id] })
      queryClient.invalidateQueries({ queryKey: ['sheet-assignments', assigningSheet.id] })
      setSelectedStudentIds([])
    },
    onError: (err) => push(err.response?.data?.detail || 'Assignment failed', 'error'),
  })

  const deleteSheetMutation = useMutation({
    mutationFn: (sheetId) => apiClient.delete(`/quizzes/sheets/${sheetId}`),
    onSuccess: () => {
      push('Sheet deleted.', 'success')
      queryClient.invalidateQueries({ queryKey: ['quiz-sheets', managingQuiz?.id] })
    },
    onError: (err) => push(err.response?.data?.detail || 'Delete failed', 'error'),
  })

  const handleUploadSheet = () => {
    const formData = new FormData()
    formData.append('title', sheetTitle)
    formData.append('file', sheetFile)
    uploadSheetMutation.mutate(formData)
  }

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (isLoading) return <Spinner />

  const assignedIds = new Set(sheetAssignments?.map((a) => a.student_id))
  const visibleQuizzes = quizzes?.filter((q) => (platinumOnly ? q.program_id === platinumProgram?.id : q.program_id !== platinumProgram?.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{platinumOnly ? 'Platinum Quizzes' : 'Quizzes'}</h1>
        <Button onClick={() => setShowCreate(true)}>Create Quiz</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleQuizzes?.map((q) => (
          <Card key={q.id} className="flex flex-col gap-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">{q.title}</p>
              <Badge color={q.is_active ? 'green' : 'slate'}>{q.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <p className="text-xs text-slate-500">{q.questions_per_attempt} questions · {q.time_limit_minutes} min · {q.passing_percent}% pass</p>
            <p className="text-xs text-slate-400">{q.max_attempts} attempts · {q.attempts_per_day}/day</p>
            <Button variant="secondary" className="mt-2" onClick={() => setManagingQuiz(q)}>
              {q.domain_id ? 'Manage Question Sheets' : 'Manage Questions'}
            </Button>
          </Card>
        ))}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Quiz"
        footer={
          <Button
            onClick={() =>
              createQuizMutation.mutate({
                ...quizForm,
                program_id: platinumOnly ? platinumProgram?.id : Number(quizForm.program_id),
                domain_id: platinumOnly ? Number(quizForm.domain_id) : undefined,
              })
            }
            disabled={createQuizMutation.isPending || (platinumOnly ? !platinumProgram || !quizForm.domain_id : !quizForm.program_id)}
          >
            Create
          </Button>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={quizForm.title} onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))} />
          {platinumOnly ? (
            <>
              <p className="text-sm text-slate-600">Program: <span className="font-medium text-slate-900">{platinumProgram?.name ?? '—'}</span></p>
              <Select label="Domain" value={quizForm.domain_id} onChange={(e) => setQuizForm((f) => ({ ...f, domain_id: e.target.value }))}>
                <option value="">Select…</option>
                {platinumProgram?.domains?.map((d) => <option key={d.id} value={d.id}>{d.name.replace('_', ' ')}</option>)}
              </Select>
            </>
          ) : (
            <Select label="Program" value={quizForm.program_id} onChange={(e) => setQuizForm((f) => ({ ...f, program_id: e.target.value }))}>
              <option value="">Select…</option>
              {programs?.filter((p) => p.code !== 'platinum').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Passing %" type="number" value={quizForm.passing_percent} onChange={(e) => setQuizForm((f) => ({ ...f, passing_percent: Number(e.target.value) }))} />
            <Input label="Time Limit (min)" type="number" value={quizForm.time_limit_minutes} onChange={(e) => setQuizForm((f) => ({ ...f, time_limit_minutes: Number(e.target.value) }))} />
            <Input label="Max Attempts" type="number" value={quizForm.max_attempts} onChange={(e) => setQuizForm((f) => ({ ...f, max_attempts: Number(e.target.value) }))} />
            <Input label="Attempts / Day" type="number" value={quizForm.attempts_per_day} onChange={(e) => setQuizForm((f) => ({ ...f, attempts_per_day: Number(e.target.value) }))} />
            <Input label="Question Bank Size" type="number" value={quizForm.question_bank_size} onChange={(e) => setQuizForm((f) => ({ ...f, question_bank_size: Number(e.target.value) }))} />
            <Input label="Questions / Attempt" type="number" value={quizForm.questions_per_attempt} onChange={(e) => setQuizForm((f) => ({ ...f, questions_per_attempt: Number(e.target.value) }))} />
          </div>
        </div>
      </Modal>

      {/* Basic / Professional / Premium: shared-pool manual question management (unchanged) */}
      <Modal open={!!managingQuiz && !isDomainQuiz} onClose={() => setManagingQuiz(null)} title={`Questions: ${managingQuiz?.title ?? ''}`} footer={null}>
        <div className="space-y-4">
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {questions?.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                <p className="font-medium">{i + 1}. {q.question_text}</p>
                <p className="text-slate-500">Correct: {q.correct_option}</p>
              </div>
            ))}
            {!questions?.length && <p className="text-sm text-slate-500">No questions yet.</p>}
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <Input label="Question" value={questionForm.question_text} onChange={(e) => setQuestionForm((f) => ({ ...f, question_text: e.target.value }))} />
            <Input label="Option A" value={questionForm.option_a} onChange={(e) => setQuestionForm((f) => ({ ...f, option_a: e.target.value }))} />
            <Input label="Option B" value={questionForm.option_b} onChange={(e) => setQuestionForm((f) => ({ ...f, option_b: e.target.value }))} />
            <Input label="Option C" value={questionForm.option_c} onChange={(e) => setQuestionForm((f) => ({ ...f, option_c: e.target.value }))} />
            <Input label="Option D" value={questionForm.option_d} onChange={(e) => setQuestionForm((f) => ({ ...f, option_d: e.target.value }))} />
            <Select label="Correct Option" value={questionForm.correct_option} onChange={(e) => setQuestionForm((f) => ({ ...f, correct_option: e.target.value }))}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </Select>
            <Button className="w-full" onClick={() => addQuestionMutation.mutate(questionForm)} disabled={addQuestionMutation.isPending}>Add Question</Button>
          </div>
        </div>
      </Modal>

      {/* Platinum domain quizzes: bulk-upload sheets + per-student assignment */}
      <Modal open={!!managingQuiz && isDomainQuiz} onClose={() => setManagingQuiz(null)} title={`Question Sheets: ${managingQuiz?.title ?? ''}`} footer={<Button onClick={() => setShowUploadSheet(true)}>Upload New Sheet</Button>}>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Each student only draws random questions from the sheet(s) assigned to them. Upload a sheet, then assign it to individual students.
          </p>
          {sheets?.length ? (
            sheets.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.title}</p>
                  <p className="text-xs text-slate-500">{s.question_count} questions · assigned to {s.assigned_student_count} student(s)</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setAssigningSheet(s)}>Assign</Button>
                  <Button variant="danger" onClick={() => deleteSheetMutation.mutate(s.id)} disabled={deleteSheetMutation.isPending}>Delete</Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No sheets uploaded yet.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        title="Upload MCQ Sheet"
        footer={<Button onClick={handleUploadSheet} disabled={!sheetTitle || !sheetFile || uploadSheetMutation.isPending}>Upload</Button>}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Excel file, one question per row: Question, Option A, Option B, Option C, Option D, Correct Option (A/B/C/D).
          </p>
          <Input label="Sheet Title" value={sheetTitle} onChange={(e) => setSheetTitle(e.target.value)} placeholder="e.g. Batch 1 - Week 1" />
          <FileUpload label="Excel File" accept=".xlsx,.xls" onChange={setSheetFile} fileName={sheetFile?.name} hint="XLSX or XLS" />
        </div>
      </Modal>

      <Modal
        open={!!assigningSheet}
        onClose={() => { setAssigningSheet(null); setSelectedStudentIds([]) }}
        title={`Assign: ${assigningSheet?.title ?? ''}`}
        footer={<Button onClick={() => assignSheetMutation.mutate()} disabled={!selectedStudentIds.length || assignSheetMutation.isPending}>Assign to {selectedStudentIds.length} Selected</Button>}
      >
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {platinumStudents?.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedStudentIds.includes(s.id) || assignedIds.has(s.id)}
                disabled={assignedIds.has(s.id)}
                onChange={() => toggleStudent(s.id)}
              />
              {s.full_name}
              {assignedIds.has(s.id) && <span className="text-xs text-emerald-600">(already assigned)</span>}
            </label>
          ))}
          {!platinumStudents?.length && <p className="text-sm text-slate-500">No active Platinum students found.</p>}
        </div>
      </Modal>
    </div>
  )
}
