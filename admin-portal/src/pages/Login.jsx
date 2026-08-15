import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      await login(values.email, values.password)
      navigate('/dashboard')
    } catch (err) {
      push(err.response?.data?.detail || err.message || 'Login failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">ARINSA AI MINDS</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to the Admin Portal</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Email" type="email" {...register('email', { required: 'Email is required' })} error={errors.email?.message} />
          <Input label="Password" type="password" {...register('password', { required: 'Password is required' })} error={errors.password?.message} />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
