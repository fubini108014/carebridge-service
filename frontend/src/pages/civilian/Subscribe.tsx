import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px 16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  backBtn: {
    background: 'none', border: 'none', color: '#06C755',
    fontSize: '15px', cursor: 'pointer', padding: 0, marginBottom: '20px',
  },
  title: { fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' },
  subtitle: { color: '#555', fontSize: '14px', marginBottom: '24px' },
  card: {
    border: '2px solid #06C755', borderRadius: '12px',
    padding: '24px', marginBottom: '24px', background: '#f6fff9',
  },
  price: { fontSize: '36px', fontWeight: 'bold', color: '#06C755', margin: '0 0 4px' },
  period: { color: '#555', fontSize: '14px', margin: '0 0 16px' },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 0' },
  feature: { fontSize: '14px', color: '#333', marginBottom: '8px' },
  btn: {
    width: '100%', padding: '14px',
    background: '#06C755', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer',
  },
  btnDisabled: {
    width: '100%', padding: '14px',
    background: '#aaa', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'not-allowed',
  },
  note: { fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '12px' },
  error: { color: 'red', fontSize: '14px', marginTop: '12px' },
};

export default function Subscribe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubscribe() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/civilian/subscribe', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '發生錯誤');
      // Redirect to the server-rendered payment form page
      window.location.href = data.paymentUrl;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '發生錯誤');
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/civilian')}>
        ← 返回
      </button>

      <h1 style={styles.title}>訂閱陪診橋</h1>
      <p style={styles.subtitle}>訂閱後即可向業務發出預約申請</p>

      <div style={styles.card}>
        <p style={styles.price}>NT$ 99</p>
        <p style={styles.period}>/ 月</p>
        <ul style={styles.featureList}>
          <li style={styles.feature}>✓ 無限次預約申請</li>
          <li style={styles.feature}>✓ 瀏覽全部業務時段</li>
          <li style={styles.feature}>✓ 預約 LINE 即時通知</li>
        </ul>
      </div>

      <button
        style={loading ? styles.btnDisabled : styles.btn}
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading ? '處理中…' : '前往付款'}
      </button>

      <p style={styles.note}>付款由藍新金流處理，訂閱期間 30 天</p>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}
