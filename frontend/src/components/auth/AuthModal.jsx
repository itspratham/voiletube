import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { loginUser, registerUser, clearError } from '@/store/slices/authSlice'
import { closeAuthModal, openAuthModal } from '@/store/slices/uiSlice'
import toast from 'react-hot-toast'
import BrandMark from '@/components/brand/BrandMark'

export default function AuthModal() {
  const dispatch = useDispatch()
  const { authModalMode } = useSelector((s) => s.ui)
  const { loading, error } = useSelector((s) => s.auth)
  const isLogin = authModalMode === 'login'

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm()

  useEffect(() => {
    reset()
    dispatch(clearError())
  }, [authModalMode])

  const onSubmit = async (data) => {
    if (isLogin) {
      const result = await dispatch(loginUser({ email: data.email, password: data.password }))
      if (loginUser.fulfilled.match(result)) {
        toast.success('Welcome back!')
        dispatch(closeAuthModal())
      }
    } else {
      const result = await dispatch(registerUser(data))
      if (registerUser.fulfilled.match(result)) {
        toast.success('Account created! Please sign in.')
        dispatch(openAuthModal('login'))
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => dispatch(closeAuthModal())} />
      <div className="glass-panel-strong relative w-full max-w-sm animate-slide-up rounded-lg p-8">
        <button
          onClick={() => dispatch(closeAuthModal())}
          className="absolute top-4 right-4 btn-ghost p-1.5 rounded-full"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <span className="inline-flex items-center justify-center gap-2 text-3xl font-bold">
            <BrandMark className="h-10 w-10" />
            <span className="text-vt-text">Voiletube</span>
          </span>
          <p className="text-vt-muted text-sm mt-1">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <input
                  {...register('username', { required: 'Username required', minLength: { value: 3, message: 'Min 3 chars' } })}
                  placeholder="Username"
                  className="input-field"
                />
                {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
              </div>
              <div>
                <input
                  {...register('channel_name')}
                  placeholder="Channel name (optional)"
                  className="input-field"
                />
              </div>
            </>
          )}

          <div>
            <input
              {...register('email', {
                required: 'Email required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' }
              })}
              type="email"
              placeholder="Email"
              className="input-field"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <input
              {...register('password', { required: 'Password required', minLength: { value: 8, message: 'Min 8 chars' } })}
              type="password"
              placeholder="Password"
              className="input-field"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {!isLogin && (
            <div>
              <input
                {...register('password_confirm', {
                  required: 'Please confirm password',
                  validate: (v) => v === watch('password') || 'Passwords do not match',
                })}
                type="password"
                placeholder="Confirm password"
                className="input-field"
              />
              {errors.password_confirm && <p className="text-red-400 text-xs mt-1">{errors.password_confirm.message}</p>}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
              {typeof error === 'string' ? error : Object.values(error).flat().join(' ')}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isLogin ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              isLogin ? 'Sign in' : 'Create account'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-vt-muted mt-4">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => dispatch(openAuthModal(isLogin ? 'register' : 'login'))}
            className="font-medium text-vt-accent transition-colors hover:text-vt-accent-hover"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
