import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UserDashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import ExamList from './pages/ExamList';
import ExamLobby from './pages/ExamLobby';
import ExamPage from './pages/ExamPage';
import ExamResults from './pages/ExamResults';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Results from './pages/Results';
import Profile from './pages/Profile';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className='app-shell'>
          <NavBar />
          <main className='page-shell'>
            <Routes>
              <Route path='/' element={<Landing />} />
              <Route path='/login' element={<Login />} />
              <Route path='/signup' element={<Signup />} />
              <Route
                path='/dashboard'
                element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin'
                element={
                  <ProtectedRoute>
                    <RoleRoute roles={['admin']}>
                      <AdminPanel />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path='/exams'
                element={
                  <ProtectedRoute>
                    <ExamList />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/groups'
                element={
                  <ProtectedRoute>
                    <Groups />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/groups/:id'
                element={
                  <ProtectedRoute>
                    <GroupDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/exam/:id'
                element={
                  <ProtectedRoute>
                    <ExamLobby />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/exam/:id/live'
                element={
                  <ProtectedRoute>
                    <ExamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/exam/:examId/results'
                element={
                  <ProtectedRoute>
                    <ExamResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/results'
                element={
                  <ProtectedRoute>
                    <Results />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/profile'
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
