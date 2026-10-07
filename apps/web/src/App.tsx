import type { PresenceUser } from '@taskflow/shared';
import { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ToastProvider } from './components/ui';
import { loadUser, saveUser } from './lib/identity';
import { getLastBoardId } from './lib/recentBoards';
import { BoardPage } from './pages/BoardPage';
import { NotFound } from './pages/NotFound';

export function AppRoutes() {
  const [user, setUser] = useState<PresenceUser>(loadUser);
  const updateUser = useCallback((next: PresenceUser) => {
    saveUser(next);
    setUser(next);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/b/${getLastBoardId()}`} replace />} />
      <Route path="/b/:boardId" element={<BoardPage user={user} onUserChange={updateUser} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ToastProvider>
  );
}
