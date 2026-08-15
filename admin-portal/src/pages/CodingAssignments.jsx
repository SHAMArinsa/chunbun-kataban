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

const EMPTY_CODING = { title: '', description: '', program_id: '', domain_id: '', num_problems: 5, required_correct: 4, max_attempts: 5, attempts_per_day: 1 }

export default function CodingAssignments({ platinumOnly = false }) {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_CODING)
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['coding-assignments'],
    queryFn: () => apiClient.get('/coding-assignments').then((r) => r.data),
  })
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  })

  const platinumProgram = programs?.find((p) => p.code === 'platinum')

  const createMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/coding-assignments', payload),
    onSuccess: () => {
      push('Coding assignment created!', 'success')
      queryClient.invalidateQueries({ queryKey: ['coding-assignments'] })
      setShowCreate(false)
      setForm(EMPTY_CODING)
    },
  })

  if (isLoading) return <Spinner />

  const visibleAssignments = assignments?.filter((a) => (platinumOnly ? !!a.domain_id : !a.domain_id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{platinumOnly ? 'Platinum Coding Assignments' : 'Coding Assignments'}</h1>
        <Button onClick={() => setShowCreate(true)}>Create Assignment</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleAssignments?.map((a) => (
          <Card key={a.id} className="flex flex-col gap-2 p-5">
            <button className="text-left text-sm font-medium text-slate-900 hover:text-brand-600 hover:underline" onClick={() => navigate(`/coding-assignments/${a.id}/manage`)}>
              {a.title}
            </button>
            <p className="text-xs text-slate-500">{a.problems?.length ?? 0}/{a.num_problems} problems · {a.required_correct} correct required</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => navigate(`/coding-assignments/${a.id}/manage`)}>
                Students &amp; Questions
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Coding Assignment"
        footer={
          <Button
            onClick={() =>
              createMutation.mutate({
                ...form,
                program_id: platinumOnly ? platinumProgram?.id : Number(form.program_id),
                domain_id: platinumOnly ? Number(form.domain_id) : undefined,
              })
            }
            disabled={createMutation.isPending || (platinumOnly ? !platinumProgram || !form.domain_id : !form.program_id)}
          >
            Create
          </Button>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          {platinumOnly ? (
            <>
              <p className="text-sm text-slate-600">Program: <span className="font-medium text-slate-900">{platinumProgram?.name ?? '—'}</span></p>
              <Select label="Domain" value={form.domain_id} onChange={(e) => setForm((f) => ({ ...f, domain_id: e.target.value }))}>
                <option value="">Select…</option>
                {platinumProgram?.domains?.map((d) => <option key={d.id} value={d.id}>{d.name.replace('_', ' ')}</option>)}
              </Select>
            </>
          ) : (
            <Select label="Program" value={form.program_id} onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}>
              <option value="">Select…</option>
              {programs?.filter((p) => p.code !== 'platinum').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Input label="# Problems" type="number" value={form.num_problems} onChange={(e) => setForm((f) => ({ ...f, num_problems: Number(e.target.value) }))} />
            <Input label="Required Correct" type="number" value={form.required_correct} onChange={(e) => setForm((f) => ({ ...f, required_correct: Number(e.target.value) }))} />
            <Input label="Max Attempts" type="number" value={form.max_attempts} onChange={(e) => setForm((f) => ({ ...f, max_attempts: Number(e.target.value) }))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
