import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { AppLayout, RequireAuth } from './components/Shell';
import { WorkspaceProvider } from './workspace';
import { LandingPage } from './pages/Landing';
import { LoginPage, SignupPage } from './pages/Auth';
import { ProjectsPage } from './pages/Projects';
import { ProjectPage } from './pages/Project';
import { LibraryPage } from './pages/Library';
import { BoardPage, GuestBoardPage } from './pages/BoardPage';
import { NotFoundPage } from './pages/NotFound';

function LegacyRedirect() {
  useEffect(() => {
    window.location.replace('/legacy.html');
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-slate-600">
      جارٍ فتح النسخة التجريبية…
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/board" element={<GuestBoardPage />} />
        <Route path="/legacy" element={<LegacyRedirect />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <WorkspaceProvider>
                <AppLayout />
              </WorkspaceProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="boards/:boardId" element={<BoardPage />} />
          <Route path="library" element={<LibraryPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
