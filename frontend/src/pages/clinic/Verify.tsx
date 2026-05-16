import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

interface BookingInfo {
  id: string;
  slotStartAt: string;
  slotEndAt: string;
  civilianName: string;
  agentName: string;
  agentPhotoUrl: string | null;
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  backBtn: { background: 'none', border: 'none', color: '#4A90E2', fontSize: '15px', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' },
  subtitle: { color: '#666', fontSize: '13px', margin: '0 0 20px' },
  infoCard: { background: '#f8f9fa', border: '1px solid #eee', borderRadius: '10px', padding: '16px', marginBottom: '24px' },
  agentRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  avatar: { width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' as const, background: '#ddd' },
  avatarPlaceholder: { width: '44px', height: '44px', borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#999' },
  agentName: { fontWeight: 'bold', fontSize: '16px' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' },
  label: { color: '#999' },
  value: { color: '#333' },
  formSection: { marginBottom: '24px' },
  inputLabel: { display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '8px', padding: '0 12px', background: '#fff' },
  prefix: { color: '#888', fontSize: '15px', marginRight: '4px', flexShrink: 0 },
  input: { flex: 1, border: 'none', outline: 'none', fontSize: '18px', padding: '12px 0', width: '100%' },
  hint: { color: '#888', fontSize: '12px', margin: '6px 0 0' },
  submitBtn: { width: '100%', padding: '14px', background: '#4A90E2', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' },
  submitBtnDisabled: { width: '100%', padding: '14px', background: '#aaa', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'not-allowed' },
  loading: { padding: '32px', textAlign: 'center', color: '#aaa' },
  error: { color: 'red', padding: '16px' },
};

function formatTW(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function ClinicVerify() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!bookingId || !token) {
      setError('缺少必要參數');
      setLoading(false);
      return;
    }

    fetch(`/api/clinic/verify/${bookingId}?token=${encodeURIComponent(token)}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setBooking(data.booking);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  async function handleSubmit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setSubmitError('請輸入有效金額');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/clinic/verify/${bookingId}/amount`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionAmount: amt, token }),
      });
      const data = await res.json() as { verificationId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? '送出失敗');
      navigate(`/clinic/verify/result?verificationId=${data.verificationId}&amount=${amt}`);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : '發生錯誤');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={styles.loading}>驗證中…</div>;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!booking) return null;

  const isValid = parseFloat(amount) > 0;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/clinic/scan')}>← 重新掃描</button>
      <h1 style={styles.title}>輸入成交金額</h1>
      <p style={styles.subtitle}>確認業務資訊後輸入本次看診成交金額</p>

      <div style={styles.infoCard}>
        <div style={styles.agentRow}>
          {booking.agentPhotoUrl ? (
            <img src={booking.agentPhotoUrl} alt={booking.agentName} style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>業</div>
          )}
          <span style={styles.agentName}>{booking.agentName}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>民眾</span>
          <span style={styles.value}>{booking.civilianName}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>服務時段</span>
          <span style={styles.value}>{formatTW(booking.slotStartAt)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>預約 ID</span>
          <span style={{ ...styles.value, fontSize: '11px', fontFamily: 'monospace' }}>{booking.id.slice(0, 8)}…</span>
        </div>
      </div>

      <div style={styles.formSection}>
        <label style={styles.inputLabel}>成交金額（診察費）</label>
        <div style={styles.inputWrap}>
          <span style={styles.prefix}>NT$</span>
          <input
            type="number"
            inputMode="numeric"
            style={styles.input}
            placeholder="0"
            value={amount}
            min={1}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <p style={styles.hint}>請輸入本次看診實際成交金額（含診察費），送出後業務將收到確認通知。</p>
      </div>

      {submitError && <p style={{ color: 'red', fontSize: '14px', marginBottom: '12px' }}>{submitError}</p>}

      <button
        style={isValid && !submitting ? styles.submitBtn : styles.submitBtnDisabled}
        disabled={!isValid || submitting}
        onClick={handleSubmit}
      >
        {submitting ? '送出中…' : '送出核銷請求'}
      </button>
    </div>
  );
}
