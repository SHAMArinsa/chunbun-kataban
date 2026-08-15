import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'

const EMPTY_FORM = { title: '', description: '', program_id: '', project_type: 'mini', week_number: '' }
const PROJECT_TYPES = ['mini', 'industry', 'end_to_end', 'live_product', 'capstone']

export default function Projects({ platinumOnly = false }) {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/projects', payload),
    onSuccess: () => {
      push('Project created!', 'success')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowCreate(false)
      setForm(EMPTY_FORM)
    },
  })

  if (isLoading) return <Spinner />

  const platinumProgram = programs?.find((p) => p.code === 'platinum')
  const visibleProjects = projects?.filter((p) => (platinumOnly ? p.program_id === platinumProgram?.id : p.program_id !== platinumProgram?.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{platinumOnly ? 'Platinum Projects' : 'Projects'}</h1>
        <Button onClick={() => setShowCreate(true)}>Create Project</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProjects?.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2 p-5">
            <button className="text-left text-sm font-medium text-slate-900 hover:text-brand-600 hover:underline" onClick={() => navigate(`/projects/${p.id}/manage`)}>
              {p.title}
            </button>
            <p className="text-xs uppercase text-slate-400">{p.project_type.replace('_', ' ')}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => navigate(`/projects/${p.id}/manage`)}>Students &amp; Submissions</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Project"
        footer={
          <Button
            onClick={() =>
              createMutation.mutate({
                ...form,
                program_id: platinumOnly ? platinumProgram?.id : Number(form.program_id),
                week_number: form.week_number ? Number(form.week_number) : null,
              })
            }
            disabled={createMutation.isPending || (platinumOnly ? !platinumProgram : !form.program_id)}
          >
            Create
          </Button>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          {platinumOnly ? (
            <p className="text-sm text-slate-600">Program: <span className="font-medium text-slate-900">{platinumProgram?.name ?? '—'}</span></p>
          ) : (
            <Select label="Program" value={form.program_id} onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}>
              <option value="">Select…</option>
              {programs?.filter((p) => p.code !== 'platinum').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <Select label="Project Type" value={form.project_type} onChange={(e) => setForm((f) => ({ ...f, project_type: e.target.value }))}>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
          <Input label="Week Number (optional)" type="number" value={form.week_number} onChange={(e) => setForm((f) => ({ ...f, week_number: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
