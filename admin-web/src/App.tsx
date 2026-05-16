import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import KycList from './pages/KycList';
import AgentList from './pages/AgentList';
import WalletAdjust from './pages/WalletAdjust';
import BroadcastQueue from './pages/BroadcastQueue';
import Settings from './pages/Settings';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const key = localStorage.getItem('adminKey');
  if (!key) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/kyc" replace />} />
          <Route path="kyc" element={<KycList />} />
          <Route path="agents" element={<AgentList />} />
          <Route path="wallet" element={<WalletAdjust />} />
          <Route path="broadcast" element={<BroadcastQueue />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
