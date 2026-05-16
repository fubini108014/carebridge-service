import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Login() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError('');
    localStorage.setItem('adminKey', key.trim());

    try {
      await api.settings.get();
      navigate('/kyc');
    } catch {
      localStorage.removeItem('adminKey');
      setError('金鑰錯誤或無法連線至後端');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>CareBridge 後台</h1>
        <p>請輸入管理員金鑰登入</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Admin Secret Key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="輸入 ADMIN_SECRET_KEY"
            autoFocus
          />
          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? '驗證中…' : '登入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
