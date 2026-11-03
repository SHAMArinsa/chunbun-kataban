import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, ShieldCheck, UserX, UserCheck } from 'lucide-react'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import { PageHeader } from '../../components/v2/Kit'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { AREAS, AREA_LABEL } from '../../lib/access'

const errText = (e) => e?.response?.data?.detail || e?.message || 'Something went wrong'
const EMPTY = { full_name: '', email: '', password: '', designation: '', is_super_admin: false, permissions: [] }

function AdminForm({ initial, editing, onClose }) {
  const qc = useQueryClient()
  const { push } = useToast()
  const [f, setF] = useState(initial)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggle = (k) => setF({ ...f, permissions: f.permissions.includes(k) ? f.permissions.filter((p) => p !== k) : [...f.permissions, k] })
  const save = useMutation({
    mutationFn: () => {
      const body = { full_name: f.full_name, designation: f.designation || null, is_super_admin: f.is_super_admin, permissions: f.permissions }
      if (editing) { if (f.password) body.password = f.password; return apiClient.put(`/admins/${initial.id}`, body) }
      return apiClient.post('/admins', { ...body, email: f.email, password: f.password })
    },
    onSuccess: () => { push(editing ? 'Admin updated.' : 'Admin created.', 'success'); qc.invalidateQueries({ queryKey: ['admins'] }); onClose() },
    onError: (e) => push(errText(e), 'error'),
  })
  const pwOk = editing ? (!f.password || f.password.length >= 8) : f.password.length >= 8
  const valid = f.full_name.trim() && (editing || /\S+@\S+\.\S+/.test(f.email)) && pwOk && (f.is_super_admin || f.permissions.length > 0)
  return (
    <Modal open wide onClose={onClose} title={editing ? `Edit ${initial.full_name}` : 'Create admin'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create admin'}</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={f.full_name} onChange={set('full_name')} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} disabled={editing} />
          <Input label={editing ? 'New password (leave blank to keep)' : 'Password (min 8 characters)'} type="password" value={f.password} onChange={set('password')} />
          <Input label="Designation (optional)" value={f.designation || ''} onChange={set('designation')} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Role</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[[true, 'Super Admin', 'Full access to everything, including creating admins and setting access.'], [false, 'Admin', 'Access only to the areas you select below.']].map(([v, t, d]) => (
              <label key={t} className={`cursor-pointer rounded-xl border-2 p-3 ${f.is_super_admin === v ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" className="sr-only" checked={f.is_super_admin === v} onChange={() => setF({ ...f, is_super_admin: v })} />
                <span className="flex items-center gap-2 font-semibold text-slate-900">{v ? <ShieldCheck size={16} className="text-brand-700" /> : <KeyRound size={16} className="text-slate-500" />}{t}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{d}</span>
              </label>
            ))}
          </div>
        </div>

        {!f.is_super_admin && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Areas this admin can access</p>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-brand-700 hover:underline" onClick={() => setF({ ...f, permissions: AREAS.map(([k]) => k) })}>Select all</button>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setF({ ...f, permissions: [] })}>Clear</button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AREAS.map(([k, label]) => (
                <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${f.permissions.includes(k) ? 'border-brand-300 bg-brand-50 text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="checkbox" checked={f.permissions.includes(k)} onChange={() => toggle(k)} />{label}
                </label>
              ))}
            </div>
            {f.permissions.length === 0 && <p className="mt-2 text-xs text-red-600">Select at least one area.</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function AdminsAccess() {
  const { user } = useAuth()
  const { push } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState(null)
  const { data: admins, isLoading } = useQuery({ queryKey: ['admins'], queryFn: () => apiClient.get('/admins').then((r) => r.data) })
  const setActive = useMutation({
    mutationFn: ({ id, is_active }) => apiClient.put(`/admins/${id}`, { is_active }),
    onSuccess: () => { push('Admin updated.', 'success'); qc.invalidateQueries({ queryKey: ['admins'] }) },
    onError: (e) => push(errText(e), 'error'),
  })
  return (
    <div className="space-y-5">
      <PageHeader title="Admins & Access" subtitle="Create admins and super admins, and choose which areas each admin can open."
        actions={<Button onClick={() => setForm({ initial: EMPTY, editing: false })}><Plus size={16} /> Create admin</Button>} />
      <Card>
        {isLoading ? <Spinner /> : (
          <ul className="divide-y divide-slate-100">
            {admins.map((a) => {
              const me = a.user_id === user?.id
              return (
                <li key={a.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${a.is_active ? '' : 'opacity-60'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-semibold text-white ${a.is_super_admin ? 'bg-brand-600' : 'bg-slate-400'}`}>{(a.full_name || '?')[0].toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{a.full_name}{me && <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>}</p>
                    <p className="text-xs text-slate-500">{a.email}{a.designation ? ` · ${a.designation}` : ''}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {a.is_super_admin
                        ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">All areas</span>
                        : a.permissions == null ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">All areas (not restricted yet)</span>
                        : a.permissions.map((p) => <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{AREA_LABEL[p] || p}</span>)}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.is_super_admin ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{a.is_super_admin ? 'Super Admin' : 'Admin'}</span>
                  {!a.is_active && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Deactivated</span>}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setForm({ initial: { ...EMPTY, ...a, password: '', permissions: a.permissions || [] }, editing: true })}><Pencil size={14} /> Edit</Button>
                    {!me && (a.is_active
                      ? <Button variant="secondary" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: a.id, is_active: false })}><UserX size={14} /> Deactivate</Button>
                      : <Button variant="secondary" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: a.id, is_active: true })}><UserCheck size={14} /> Activate</Button>)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <p className="text-xs text-slate-500">Access is enforced by the server too — an admin can't open an area's data even by typing its address. Deactivating or changing a password signs that admin out.</p>
      {form && <AdminForm initial={form.initial} editing={form.editing} onClose={() => setForm(null)} />}
    </div>
  )
}
