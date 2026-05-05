'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function LoginForm() {
  const { login, isLoading } = useAuth()
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data) => {
    try {
      setError(null)
      await login(data.email, data.password)
    } catch (err) {
      let errorMessage = 'Login failed. Please check your credentials.'

      if (err instanceof Error) {
        errorMessage = err.message
        // Handle specific Appwrite errors
        if (err.message.includes('Invalid credentials')) {
          errorMessage = 'Invalid email or password. Please try again.'
        } else if (err.message.includes('User not found')) {
          errorMessage = 'User account does not exist. Please contact administrator.'
        } else if (err.message.includes('Appwrite')) {
          errorMessage = 'System is not configured. Please complete Appwrite setup (see README.md).'
        }
      }

      setError(errorMessage)
      console.error('Login error:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-700">Email Address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            {...register('email')}
            className={errors.email ? 'h-11 border-red-500 pl-10' : 'h-11 border-slate-200 bg-slate-50/70 pl-10'}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-slate-700">Password</Label>
          <button type="button" className="text-xs font-medium text-[#047857] transition hover:text-[#065f46]">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            {...register('password')}
            className={errors.password ? 'h-11 border-red-500 pl-10 pr-11' : 'h-11 border-slate-200 bg-slate-50/70 pl-10 pr-11'}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center justify-center gap-2 text-sm text-slate-600">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
        Remember me
      </label>

      <Button
        type="submit"
        disabled={isLoading}
        className="h-11 w-full bg-[#047857] text-sm font-semibold text-white hover:bg-[#ff8829]"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      <p className="text-center text-xs text-slate-500">
        Don&apos;t have an account?{' '}
        <button type="button" className="font-semibold text-[#ff8829] hover:text-[#e6771f]">
          Contact administrator
        </button>
      </p>
    </form>
  )
}
