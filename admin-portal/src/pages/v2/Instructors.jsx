import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import { PageHeader, Status } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { errorText } from '../../lib/v2'

export default function Instructors() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({})
  const { data } = useQuery({ queryKey: ['instructors'], queryFn: () => apiClient.get('/instructors').then((r) => r.data) })
  const done = (msg) => ({ onSuccess: () => { push(msg, 'success'); setOpen(false); setF({}); qc.invalidateQueries({ queryKey: ['instructors'] }) }, onError: (e) => push(errorText(e), 'error') })
  const create = useMutation({ mutationFn: () => apiClient.post('/instructors', f), ...done('Instructor created') })
  const toggle = useMutation({ mutationFn: (r) => apiClient.patch(`/instructors/${r.id}`, { is_active: !r.is_active }), ...done('Updated') })
  return (
    <div className="space-y-4">
      <PageHeader title="Instructors" subtitle="Instructors manage students, materials, work, evaluations, certificates, interviews and support — but never prices, offers, payments or financial reports."
        actions={<Button onClick={() => setOpen(true)}>Add instructor</Button>} />
      <Card>
        <Table rows={data} emptyMessage="No instructors yet." columns={[
          { key: 'full_name', header: 'Name' }, { key: 'email', header: 'Email' },
          { key: 'is_active', header: 'Status', render: (r) => <Status value={r.is_active ? 'active' : 'suspended'} label={r.is_active ? 'Active' : 'Deactivated'} /> },
          { key: 't', header: '', render: (r) => <Button variant={r.is_active ? 'ghost' : 'secondary'} onClick={() => toggle.mutate(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</Button> },
        ]} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New instructor" footer={<Button disabled={create.isPending} onClick={() => create.mutate()}>Create</Button>}>
        <div className="space-y-3">
          <Input label="Full name" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Input label="Email" type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input label="Temporary password (min 8 characters)" type="password" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
