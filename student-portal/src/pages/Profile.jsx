import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import apiClient from '../api/client'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'

export default function Profile() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['students', 'me'],
    queryFn: () => apiClient.get('/students/me').then((r) => r.data),
  })
  const { register, handleSubmit, reset } = useForm()

  useEffect(() => {
    if (profile) reset(profile)
  }, [profile, reset])

  const updateMutation = useMutation({
    mutationFn: (payload) => apiClient.put('/students/me', payload),
    onSuccess: () => {
      push('Profile updated!', 'success')
      queryClient.invalidateQueries({ queryKey: ['students', 'me'] })
    },
    onError: () => push('Update failed', 'error'),
  })

  if (isLoading) return <Spinner />

  const onSubmit = (values) => {
    const { full_name, phone, city, state, country, institution, degree, graduation_year, github_url, linkedin_url } = values
    updateMutation.mutate({ full_name, phone, city, state, country, institution, degree, graduation_year: graduation_year ? Number(graduation_year) : null, github_url, linkedin_url })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
      <Card className="max-w-2xl p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full Name" {...register('full_name')} />
          <Input label="Phone" {...register('phone')} />
          <Input label="City" {...register('city')} />
          <Input label="State" {...register('state')} />
          <Input label="Country" {...register('country')} />
          <Input label="Institution" {...register('institution')} />
          <Input label="Degree" {...register('degree')} />
          <Input label="Graduation Year" type="number" {...register('graduation_year')} />
          <Input label="GitHub URL" {...register('github_url')} />
          <Input label="LinkedIn URL" {...register('linkedin_url')} />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
