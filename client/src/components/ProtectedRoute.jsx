import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loader"><span className="loader-ring"/>Checking your session</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/workspace'} replace />;
  return <Outlet/>;
}
