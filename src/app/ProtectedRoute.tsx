import { Navigate, Outlet } from 'react-router'

import { useAuth } from '../features/auth/AuthContext'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AdminRoute() {
  const { session, profile, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
