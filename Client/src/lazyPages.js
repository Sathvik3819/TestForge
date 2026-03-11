import { lazy } from 'react';

function createLazyPage(loader) {
  const LazyPage = lazy(loader);
  LazyPage.preload = loader;
  return LazyPage;
}

export const Landing = createLazyPage(() => import('./pages/Landing'));
export const Login = createLazyPage(() => import('./pages/Login'));
export const Signup = createLazyPage(() => import('./pages/Signup'));
export const UserDashboard = createLazyPage(() => import('./pages/Dashboard'));
export const AdminPanel = createLazyPage(() => import('./pages/AdminPanel'));
export const ExamList = createLazyPage(() => import('./pages/ExamList'));
export const ExamLobby = createLazyPage(() => import('./pages/ExamLobby'));
export const ExamPage = createLazyPage(() => import('./pages/ExamPage'));
export const ExamResults = createLazyPage(() => import('./pages/ExamResults'));
export const Groups = createLazyPage(() => import('./pages/Groups'));
export const GroupDetail = createLazyPage(() => import('./pages/GroupDetail'));
export const JoinGroup = createLazyPage(() => import('./pages/JoinGroup'));
export const Results = createLazyPage(() => import('./pages/Results'));
export const Profile = createLazyPage(() => import('./pages/Profile'));

const routePreloaders = {
  '/': Landing.preload,
  '/login': Login.preload,
  '/signup': Signup.preload,
  '/dashboard': UserDashboard.preload,
  '/admin': AdminPanel.preload,
  '/exams': ExamList.preload,
  '/groups': Groups.preload,
  '/profile': Profile.preload,
  '/results': Results.preload,
};

export function preloadRoute(path) {
  routePreloaders[path]?.();
}
