import { Suspense, useContext, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, AuthProvider } from './context/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import {
  AdminPanel,
  ExamList,
  ExamLobby,
  ExamPage,
  ExamResults,
  GroupDetail,
  Groups,
  JoinGroup,
  Landing,
  Login,
  Profile,
  Results,
  Signup,
  UserDashboard,
} from './lazyPages';
import './App.css';

function RouteFallback() {
  return (
    <div className='container'>
      <div className='card' style={{ minHeight: '160px', display: 'grid', placeItems: 'center' }}>
        <LoadingSpinner label='Loading...' />
      </div>
    </div>
  );
}

function AppShell() {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const preloadPages = () => {
      if (user) {
        const authedPages = [UserDashboard, Groups, GroupDetail, ExamList, Profile, Results];
        if (user.role === 'admin') {
          authedPages.push(AdminPanel);
        }

        authedPages.forEach((page) => page.preload?.());
        return;
      }

      [Landing, Login, Signup].forEach((page) => page.preload?.());
    };

    const scheduleIdleTask = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 250));
    const cancelIdleTask = window.cancelIdleCallback || window.clearTimeout;
    const taskId = scheduleIdleTask(preloadPages);

    return () => cancelIdleTask(taskId);
  }, [user]);

  return (
    <BrowserRouter>
      <div className='app-shell'>
        <NavBar />
        <main className='page-shell'>
          <Suspense fallback={<RouteFallback />}>
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
                    <AdminPanel />
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
                path='/join/:token'
                element={
                  <ProtectedRoute>
                    <JoinGroup />
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
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
