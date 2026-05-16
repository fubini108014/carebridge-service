import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/kyc', label: '📋 KYC 審核' },
  { to: '/agents', label: '👤 業務管理' },
  { to: '/wallet', label: '💰 手動調帳' },
  { to: '/broadcast', label: '📢 推播審核' },
  { to: '/settings', label: '⚙️ 平台設定' },
];

export default function Layout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('adminKey');
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          CareBridge
          <small>後台管理系統</small>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          管理員模式
          <button onClick={logout}>登出</button>
        </div>
      </aside>
      <main className="main">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
