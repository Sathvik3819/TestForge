import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ExamList from './pages/ExamList';
import ExamPage from './pages/ExamPage';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className='app-shell'>
          <NavBar />
          <main className='page-shell'>
            <Routes>
              <Route path='/' element={<Home />} />
              <Route path='/login' element={<Login />} />
              <Route path='/signup' element={<Signup />} />
              <Route
                path='/dashboard'
                element={
                  <ProtectedRoute>
                    <Dashboard />
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
                path='/exam/:id'
                element={
                  <ProtectedRoute>
                    <ExamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/create-exam'
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/admin'
                element={
                  <ProtectedRoute>
                    <Admin />
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
