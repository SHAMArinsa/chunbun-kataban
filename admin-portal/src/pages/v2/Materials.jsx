import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Plus } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import Table from '../../components/ui/Table'
import { PageHeader, Status, Tabs, TextArea } from '../../components/v2/Kit'
import { useToast } from '../../context/ToastContext'
import { downloadFile, errorText, fmtDate, humanize } from '../../lib/v2'

export default function Materials() {
  const qc = useQueryClient()
  const { push } = useToast()
  const [programId, setProgramId] = useState(null)
  const [edit, setEdit] = useState(null)
  const [file, setFile] = useState(null)
  const [del, setDel] = useState(null)
  const { data: programs } = useQuery({ queryKey: ['v2', 'programs'], queryFn: () => apiClient.get('/v2/staff/programs').then((r) => r.data) })
  const visible = (programs || []).filter((p) => p.is_v2 || p.enrolled > 0)
  useEffect(() => { if (!programId && visible.length) setProgramId(visible[0].id) }, [visible, programId])
  const key = ['materials', programId]
  const { data, isLoading } = useQuery({ queryKey: key, enabled: !!programId, queryFn: () => apiClient.get('/materials', { params: { program_id: programId } }).then((r) => r.data) })
  const opts = (msg) => ({ onSuccess: () => { push(msg, 'success'); setEdit(null); setFile(null); setDel(null); qc.invalidateQueries({ queryKey: ['materials'] }) }, onError: (e) => push(errorText(e), 'error') })
  const create = useMutation({ mutationFn: (fd) => apiClient.post('/materials', fd), ...opts('Material added') })
  const update = useMutation({ mutationFn: ({ id, body }) => apiClient.patch(`/materials/${id}`, body), ...opts('Material updated') })
  const replace = useMutation({ mutationFn: ({ id, fd }) => apiClient.put(`/materials/${id}/replace-file`, fd), ...opts('File replaced') })
  const remove = useMutation({ mutationFn: (id) => apiClient.delete(`/materials/${id}`), ...opts('Material removed') })

  const save = () => {
    if (edit.id) {
      update.mutate({ id: edit.id, body: { title: edit.title, description: edit.description, display_order: Number(edit.display_order || 0), publication_state: edit.publication_state, resource_url: edit.resource_url } })
      if (file) {
        const fd = new FormData(); fd.append('file', file)
        replace.mutate({ id: edit.id, fd })
      }
      return
    }
    const fd = new FormData()
    Object.entries({ ...edit, program_id: programId }).forEach(([k, v]) => v !== '' && v != null && fd.append(k, v))
    if (edit.content_type === 'file' && file) fd.append('file', file)
    create.mutate(fd)
  }
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })

  return (
    <div>
      <PageHeader title="Study Materials" subtitle="PDFs, documents, videos and links for each program. Only published items are visible to that program’s students."
        actions={<Button disabled={!programId} onClick={() => { setEdit({ content_type: 'file', publication_state: 'published', display_order: (data?.length || 0) + 1 }); setFile(null) }}><Plus size={16} /> Add material</Button>} />
      <Tabs tabs={visible.map((p) => ({ key: p.id, label: p.name }))} value={programId} onChange={setProgramId} />
      <Card>
        {isLoading ? <Spinner /> : (
          <Table rows={data} emptyMessage="No materials for this program yet." columns={[
            { key: 'display_order', header: 'Order' },
            { key: 'title', header: 'Title' },
            { key: 'content_type', header: 'Type', render: (r) => (r.content_type === 'file' ? (r.file_type || 'file').toUpperCase() : humanize(r.content_type)) },
            { key: 'publication_state', header: 'Status', render: (r) => <Status value={r.publication_state === 'published' ? 'active' : 'draft'} label={humanize(r.publication_state)} /> },
            { key: 'updated_at', header: 'Updated', render: (r) => fmtDate(r.updated_at) },
            {
              key: 'a', header: '', render: (r) => (
                <div className="flex gap-3 text-xs">
                  {r.content_type === 'file'
                    ? <button className="text-brand-700 hover:underline" onClick={() => downloadFile(`/materials/${r.id}/download`)}>Download</button>
                    : <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={r.resource_url} target="_blank" rel="noreferrer">Open <ExternalLink size={12} /></a>}
                  <button className="text-slate-600 hover:underline" onClick={() => update.mutate({ id: r.id, body: { publication_state: r.publication_state === 'published' ? 'draft' : 'published' } })}>{r.publication_state === 'published' ? 'Unpublish' : 'Publish'}</button>
                  <button className="text-slate-600 hover:underline" onClick={() => { setEdit(r); setFile(null) }}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => setDel(r)}>Remove</button>
                </div>
              ),
            },
          ]} />
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? 'Edit material' : 'Add material'} footer={<Button disabled={!edit?.title || create.isPending || update.isPending} onClick={save}>Save</Button>}>
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Input label="Title" value={edit.title || ''} onChange={set('title')} /></div>
            {!edit.id && (
              <Select label="Type" value={edit.content_type} onChange={set('content_type')}>
                <option value="file">File (PDF, DOCX, ZIP, image)</option><option value="video">Video link</option><option value="link">Resource link</option>
              </Select>
            )}
            <Input label="Display order" type="number" value={edit.display_order ?? 0} onChange={set('display_order')} />
            <Select label="Status" value={edit.publication_state} onChange={set('publication_state')}><option value="published">Published</option><option value="draft">Draft (hidden)</option></Select>
            {edit.content_type === 'file'
              ? <label className="block text-sm sm:col-span-2"><span className="mb-1 block font-medium text-slate-700">{edit.id ? 'Replace file (optional)' : 'File'}</span><input type="file" accept=".pdf,.docx,.zip,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
              : <div className="sm:col-span-2"><Input label="URL (YouTube, Drive, etc.)" value={edit.resource_url || ''} onChange={set('resource_url')} /></div>}
            <div className="sm:col-span-2"><TextArea label="Description" value={edit.description || ''} onChange={set('description')} rows={3} /></div>
          </div>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove material" footer={<Button variant="danger" onClick={() => remove.mutate(del.id)}>Remove</Button>}>
        <p className="text-sm">Remove “{del?.title}”? Students will no longer see it. Tip: use <b>Unpublish</b> to hide it temporarily instead.</p>
      </Modal>
    </div>
  )
}
