import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { EmptyState, Spinner } from './ui'

export default function ProtectedRoute({ children, perms }) {
  const { user, loading, hasPerm } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Validando sesión…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (perms && !hasPerm(...perms)) {
    return <EmptyState icon={ShieldAlert} title="Acceso restringido" text="Tu rol no tiene permisos para ver esta sección." />
  }
  return children
}
