import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { authHeaders } from '../../lib/liff';

const TOKEN_TTL_MS = 5 * 60 * 1000;
const REFRESH_BEFORE_MS = 30 * 1000; // refresh 30 sec before expiry

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'center' },
  backBtn: { background: 'none', border: 'none', color: '#06C755', fontSize: '15px', cursor: 'pointer', padding: 0, marginBottom: '16px', display: 'block', textAlign: 'left' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' },
  subtitle: { color: '#666', fontSize: '13px', margin: '0 0 24px' },
  qrBox: { border: '1px solid #eee', borderRadius: '12px', padding: '24px', display: 'inline-block', background: '#fff', marginBottom: '16px' },
  timer: { fontSize: '13px', color: '#888', margin: '0 0 8px' },
  timerWarning: { fontSize: '13px', color: '#ff5555', margin: '0 0 8px' },
  refreshBtn: { padding: '10px 24px', background: '#06C755', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '15px', cursor: 'pointer' },
  loading: { padding: '48px', color: '#aaa' },
  error: { color: 'red', padding: '16px' },
  notice: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#795548', marginTop: '16px', textAlign: 'left' },
};

export default function AgentQrCode() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchToken() {
    setError('');
    try {
      const res = await fetch(`/api/agent/bookings/${bookingId}/qrcode-token`, {
        headers: authHeaders(),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? '無法取得 QR Code');

      const token = data.token!;
      const exp = Date.now() + TOKEN_TTL_MS;
      setExpiresAt(exp);

      const content = token;
      const dataUrl = await QRCode.toDataURL(content, { width: 240, margin: 1 });
      setQrDataUrl(dataUrl);

      // Schedule auto-refresh 30 sec before expiry
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(fetchToken, TOKEN_TTL_MS - REFRESH_BEFORE_MS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '發生錯誤');
    }
  }

  useEffect(() => {
    if (!bookingId) return;
    fetchToken();
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [bookingId]);

  const secondsLeft = Math.max(0, Math.round((expiresAt - now) / 1000));
  const isExpiringSoon = secondsLeft <= 30 && secondsLeft > 0;
  const isExpired = expiresAt > 0 && secondsLeft === 0;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/agent')}>← 返回</button>
      <h1 style={styles.title}>出示 QR Code</h1>
      <p style={styles.subtitle}>讓診所掃描以核銷本次服務</p>

      {error && <div style={styles.error}>{error}</div>}

      {!error && !qrDataUrl && <div style={styles.loading}>產生中…</div>}

      {qrDataUrl && (
        <>
          <div style={styles.qrBox}>
            <img src={qrDataUrl} alt="QR Code" width={240} height={240} />
          </div>

          {!isExpired && (
            <p style={isExpiringSoon ? styles.timerWarning : styles.timer}>
              {isExpiringSoon ? `即將過期：剩餘 ${secondsLeft} 秒` : `有效時間：${secondsLeft} 秒`}
            </p>
          )}

          {isExpired && (
            <div>
              <p style={styles.timerWarning}>QR Code 已過期</p>
              <button style={styles.refreshBtn} onClick={fetchToken}>重新產生</button>
            </div>
          )}
        </>
      )}

      <div style={styles.notice}>
        此 QR Code 有效期限為 5 分鐘，每次出示前請確認時間充足。診所掃描後將輸入成交金額送出核銷請求。
      </div>
    </div>
  );
}
