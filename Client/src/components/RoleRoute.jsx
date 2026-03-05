import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function RoleRoute({ children, roles }) {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to='/login' replace />;
  if (!roles?.includes(user.role)) return <Navigate to='/dashboard' replace />;

  return children;
}
