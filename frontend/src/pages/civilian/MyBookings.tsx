import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

interface Slot { startAt: string; endAt: string }
interface AgentUser { displayName: string; pictureUrl: string | null }
interface AgentProfile { user: AgentUser }

interface Booking {
  id: string;
  status: string;
  amount: string;
  paymentUrl: string | null;
  slot: Slot;
  agentProfile: AgentProfile;
  cancelledAt: string | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING_AGENT:    { text: '等待業務接受', color: '#f5a623' },
  LOCKED:           { text: '待付款', color: '#4A90E2' },
  CONFIRMED:        { text: '已確認', color: '#06C755' },
  CANCELLED_CIVILIAN: { text: '已取消', color: '#aaa' },
  CANCELLED_AGENT:  { text: '業務取消', color: '#aaa' },
  EXPIRED_AGENT:    { text: '業務逾時', color: '#ff5555' },
  EXPIRED_PAYMENT:  { text: '付款逾時', color: '#ff5555' },
};

const CANCELLABLE = new Set(['PENDING_AGENT', 'LOCKED', 'CONFIRMED']);

function formatTW(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  title: { fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' },
  card: {
    border: '1px solid #eee', borderRadius: '8px', padding: '14px',
    marginBottom: '12px', background: '#fff',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  agentName: { fontWeight: 'bold', fontSize: '15px' },
  statusBadge: {
    fontSize: '12px', padding: '2px 8px', borderRadius: '12px',
    background: '#f0f0f0', fontWeight: 500,
  },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' },
  label: { color: '#999' },
  value: { color: '#333' },
  btnRow: { display: 'flex', gap: '8px', marginTop: '10px' },
  payBtn: {
    flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
    background: '#4A90E2', color: '#fff', fontSize: '14px', cursor: 'pointer',
    textDecoration: 'none', textAlign: 'center',
  },
  cancelBtn: {
    flex: 1, padding: '8px', borderRadius: '6px',
    border: '1px solid #ff5555', background: '#fff',
    color: '#ff5555', fontSize: '14px', cursor: 'pointer',
  },
  detailBtn: {
    flex: 1, padding: '8px', borderRadius: '6px',
    border: '1px solid #06C755', background: '#fff',
    color: '#06C755', fontSize: '14px', cursor: 'pointer',
  },
  empty: { textAlign: 'center', color: '#aaa', padding: '48px 16px' },
  loading: { padding: '32px', textAlign: 'center', color: '#888' },
  error: { color: 'red', padding: '16px' },
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/civilian/bookings', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setBookings(data.bookings ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: string) => {
    if (!confirm('確定要取消這個預約？')) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/civilian/bookings/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '取消失敗');
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '取消失敗');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <div style={styles.loading}>載入中…</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div style={styles.container}>
      <p style={styles.title}>我的預約</p>

      {bookings.length === 0 && (
        <div style={styles.empty}>
          <p>目前沒有預約紀錄</p>
          <button
            style={{ ...styles.detailBtn, width: 'auto', padding: '10px 24px', marginTop: '12px' }}
            onClick={() => navigate('/civilian')}
          >
            去預約業務
          </button>
        </div>
      )}

      {bookings.map((b) => {
        const info = STATUS_LABEL[b.status] ?? { text: b.status, color: '#888' };
        const canCancel = CANCELLABLE.has(b.status);

        return (
          <div key={b.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.agentName}>{b.agentProfile.user.displayName}</span>
              <span style={{ ...styles.statusBadge, color: info.color }}>{info.text}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>時段</span>
              <span style={styles.value}>{formatTW(b.slot.startAt)}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>媒合費</span>
              <span style={styles.value}>NT$ {b.amount}</span>
            </div>

            <div style={styles.btnRow}>
              <button
                style={styles.detailBtn}
                onClick={() => navigate(`/civilian/booking/result?bookingId=${b.id}`)}
              >
                詳情
              </button>
              {b.status === 'LOCKED' && b.paymentUrl && (
                <a href={b.paymentUrl} style={styles.payBtn}>付款</a>
              )}
              {canCancel && (
                <button
                  style={styles.cancelBtn}
                  disabled={cancelling === b.id}
                  onClick={() => handleCancel(b.id)}
                >
                  {cancelling === b.id ? '取消中…' : '取消預約'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
