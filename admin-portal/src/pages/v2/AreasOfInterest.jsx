import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import { PageHeader, Status } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { errorText } from '../../lib/v2'

const SUGGESTED = ['Development', 'Testing / QA', 'Support', 'AI / ML', 'Generative AI', 'Frontend', 'Backend', 'Full Stack', 'Database', 'DevOps']

export default function AreasOfInterest() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [name, setName] = useState('')
  const { data } = useQuery({ queryKey: ['v2', 'areas'], queryFn: () => apiClient.get('/v2/staff/areas-of-interest').then((r) => r.data) })
  const opts = { onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['v2', 'areas'] }) }, onError: (e) => push(errorText(e), 'error') }
  const create = useMutation({ mutationFn: (n) => apiClient.post('/v2/staff/areas-of-interest', { name: n, display_order: (data?.length || 0) + 1 }), ...opts })
  const update = useMutation({ mutationFn: (a) => apiClient.put(`/v2/staff/areas-of-interest/${a.id}`, a), ...opts })
  const missing = SUGGESTED.filter((s) => !data?.some((a) => a.name.toLowerCase() === s.toLowerCase()))
  return (
    <div className="space-y-4">
      <PageHeader title="Areas of Interest" subtitle="Options students choose on the Internship Form (Advanced, Career, Career Accelerator)." />
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1"><Input label="New area" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button disabled={!name.trim()} onClick={() => create.mutate(name.trim())}>Add</Button>
        {missing.length > 0 && <Button variant="secondary" onClick={() => missing.forEach((m) => create.mutate(m))}>Add suggested ({missing.length})</Button>}
      </Card>
      <Card>
        <Table rows={data} emptyMessage="No areas yet." columns={[
          { key: 'display_order', header: 'Order' }, { key: 'name', header: 'Name' },
          { key: 'active', header: 'Status', render: (r) => <Status value={r.active ? 'active' : 'draft'} label={r.active ? 'Shown' : 'Hidden'} /> },
          { key: 't', header: '', render: (r) => <Button variant="ghost" onClick={() => update.mutate({ ...r, active: !r.active })}>{r.active ? 'Hide' : 'Show'}</Button> },
        ]} />
      </Card>
    </div>
  )
}
