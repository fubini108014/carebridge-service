import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

interface Agent {
  id: string;
  user: { displayName: string; pictureUrl: string | null };
}

interface Slot {
  id: string;
  startAt: string;
  endAt: string;
}

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

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  title: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' },
  card: {
    background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px',
    padding: '16px', marginBottom: '20px',
  },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' },
  label: { color: '#888' },
  value: { fontWeight: 500 },
  note: { fontSize: '13px', color: '#ff5555', marginBottom: '20px' },
  btn: {
    width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
    background: '#06C755', color: '#fff', fontSize: '16px', fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  error: { color: 'red', marginBottom: '12px', fontSize: '14px' },
  loading: { padding: '32px', textAlign: 'center', color: '#888' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'none', border: 'none', color: '#06C755',
    fontSize: '15px', cursor: 'pointer', marginBottom: '16px', padding: 0,
  },
};

export default function BookingConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const slotId = params.get('slotId') ?? '';
  const agentId = params.get('agentId') ?? '';

  const [agent, setAgent] = useState<Agent | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [fee, setFee] = useState<string>('500');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/civilian/agents/${agentId}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAgent(data.agent);
        const found = data.agent.availabilitySlots?.find((s: Slot) => s.id === slotId);
        if (found) setSlot(found);
      })
      .catch((e) => setError(e.message));

    // Try to get booking fee from admin settings (best-effort)
    fetch('/api/civilian/agents', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.bookingFee) setFee(String(data.bookingFee));
      })
      .catch(() => {/* ignore */});
  }, [agentId, slotId]);

  const handleSubmit = async () => {
    if (!slotId || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/civilian/bookings', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '預約失敗');
      navigate(`/civilian/booking/result?bookingId=${data.booking.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '發生錯誤');
      setSubmitting(false);
    }
  };

  if (!slotId || !agentId) return <div style={styles.error}>缺少必要參數</div>;
  if (!agent) return <div style={styles.loading}>載入中…</div>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate(-1)}>← 返回</button>
      <p style={styles.title}>確認預約</p>

      <div style={styles.card}>
        <div style={styles.row}>
          <span style={styles.label}>業務</span>
          <span style={styles.value}>{agent.user.displayName}</span>
        </div>
        {slot ? (
          <>
            <div style={styles.row}>
              <span style={styles.label}>時段</span>
              <span style={styles.value}>{formatTW(slot.startAt)}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>結束</span>
              <span style={styles.value}>{formatTW(slot.endAt)}</span>
            </div>
          </>
        ) : (
          <div style={styles.row}>
            <span style={styles.label}>時段</span>
            <span style={{ ...styles.value, color: '#aaa' }}>載入中…</span>
          </div>
        )}
        <div style={styles.row}>
          <span style={styles.label}>媒合費</span>
          <span style={{ ...styles.value, color: '#06C755' }}>NT$ {fee}</span>
        </div>
      </div>

      <p style={styles.note}>提交後業務需在 30 分鐘內接受，接受後請在 30 分鐘內完成付款。</p>

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? '送出中…' : '送出預約申請'}
      </button>
    </div>
  );
}
