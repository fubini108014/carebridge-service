import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import liff from '@line/liff';

const IS_DEV = import.meta.env.DEV && !import.meta.env.VITE_LIFF_ID;

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'center' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' },
  subtitle: { color: '#666', fontSize: '13px', margin: '0 0 32px' },
  scanBtn: {
    width: '100%', padding: '16px',
    background: '#4A90E2', border: 'none', borderRadius: '10px',
    color: '#fff', fontWeight: 'bold', fontSize: '17px', cursor: 'pointer',
    marginBottom: '16px',
  },
  devInput: { width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box' as const },
  devBtn: { width: '100%', padding: '10px', background: '#888', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', marginBottom: '16px' },
  error: { color: 'red', fontSize: '14px', margin: '8px 0' },
  notice: { background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#1565c0', textAlign: 'left' as const },
};

function parseToken(raw: string): { bookingId: string; token: string } | null {
  // QR Code content is just the raw HMAC token
  // Token format: base64url(JSON{bookingId,exp}).hexHmac
  // We extract bookingId from the base64 payload
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = raw.slice(0, dot);
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (!json.bookingId) return null;
    return { bookingId: json.bookingId, token: raw };
  } catch {
    return null;
  }
}

export default function ClinicScan() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [devToken, setDevToken] = useState('');

  async function handleScan() {
    setError('');
    setScanning(true);
    try {
      const result = await liff.scanCodeV2();
      const raw = result.value ?? '';
      const parsed = parseToken(raw);
      if (!parsed) {
        setError('無效的 QR Code，請重新掃描');
        return;
      }
      navigate(`/clinic/verify/${parsed.bookingId}?token=${encodeURIComponent(parsed.token)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '掃描失敗');
    } finally {
      setScanning(false);
    }
  }

  function handleDevSubmit() {
    if (!devToken.trim()) return;
    const parsed = parseToken(devToken.trim());
    if (!parsed) {
      setError('Token 格式錯誤');
      return;
    }
    navigate(`/clinic/verify/${parsed.bookingId}?token=${encodeURIComponent(parsed.token)}`);
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>掃描業務 QR Code</h1>
      <p style={styles.subtitle}>使用鏡頭掃描業務出示的核銷 QR Code</p>

      {!IS_DEV && (
        <button style={styles.scanBtn} onClick={handleScan} disabled={scanning}>
          {scanning ? '掃描中…' : '開啟相機掃描'}
        </button>
      )}

      {IS_DEV && (
        <>
          <p style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>[Dev 模式] 貼上 QR Token 測試</p>
          <input
            style={styles.devInput}
            placeholder="貼上 QR token"
            value={devToken}
            onChange={(e) => setDevToken(e.target.value)}
          />
          <button style={styles.devBtn} onClick={handleDevSubmit}>送出測試</button>
        </>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.notice}>
        請確認業務已開啟 QR Code 頁面，並保持螢幕亮度。掃描成功後將進入金額輸入頁面。
      </div>
    </div>
  );
}
