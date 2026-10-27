import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Account from './pages/Account'
import Claims from './pages/Claims'
import Complaints from './pages/Complaints'
import Compliments from './pages/Compliments'
import Dashboard from './pages/Dashboard'
import Financing from './pages/Financing'
import Help from './pages/Help'
import Home from './pages/Home'
import Login from './pages/Login'
import NewPassword from './pages/NewPassword'
import RecoverPassword from './pages/RecoverPassword'
import Requests from './pages/Requests'
import VerifyCode from './pages/VerifyCode'

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={user ? <Navigate to="/inicio" replace /> : <Login />} />
      <Route path="/recuperar-password" element={<RecoverPassword />} />
      <Route path="/codigo-verificacion" element={<VerifyCode />} />
      <Route path="/nueva-password" element={<NewPassword />} />

      {/* Privadas */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/inicio" element={<Home />} />
        <Route path="/solicitudes" element={<ProtectedRoute perms={['requests.create', 'requests.manage', 'requests.view_all']}><Requests /></ProtectedRoute>} />
        <Route path="/financiamiento" element={<ProtectedRoute perms={['financing.view_own', 'financing.manage']}><Financing /></ProtectedRoute>} />
        <Route path="/cuenta" element={<Account />} />
        <Route path="/ayuda" element={<Help />} />
        <Route path="/denuncias" element={<ProtectedRoute perms={['complaints.create', 'complaints.manage']}><Complaints /></ProtectedRoute>} />
        <Route path="/reclamos" element={<ProtectedRoute perms={['claims.create', 'claims.manage', 'claims.view_all']}><Claims /></ProtectedRoute>} />
        <Route path="/felicitaciones" element={<ProtectedRoute perms={['compliments.create', 'compliments.view']}><Compliments /></ProtectedRoute>} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/inicio' : '/login'} replace />} />
    </Routes>
  )
}
