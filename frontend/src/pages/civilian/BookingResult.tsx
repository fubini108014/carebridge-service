import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

interface Booking {
  id: string;
  status: string;
  paymentUrl: string | null;
  amount: string;
  slot: { startAt: string; endAt: string };
  agentProfile: { user: { displayName: string } };
}

const STATUS_LABEL: Record<string, { text: string; color: string; desc: string }> = {
  PENDING_AGENT: {
    text: '等待業務接受',
    color: '#f5a623',
    desc: '業務需在 30 分鐘內回應，請稍候。',
  },
  LOCKED: {
    text: '請完成付款',
    color: '#4A90E2',
    desc: '業務已接受！請在 30 分鐘內完成付款。',
  },
  CONFIRMED: {
    text: '預約成功',
    color: '#06C755',
    desc: '付款完成，預約已確認！期待為您服務。',
  },
  CANCELLED_CIVILIAN: { text: '已取消（民眾）', color: '#888', desc: '您已取消此預約。' },
  CANCELLED_AGENT: { text: '已取消（業務）', color: '#888', desc: '業務已取消此預約，將全額退款。' },
  EXPIRED_AGENT: { text: '業務未回應', color: '#ff5555', desc: '業務未在時限內回應，預約已自動取消。' },
  EXPIRED_PAYMENT: { text: '付款逾時', color: '#ff5555', desc: '未在時限內完成付款，預約已自動取消。' },
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

const POLLING_STATUSES = new Set(['PENDING_AGENT', 'LOCKED']);

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  statusBox: {
    textAlign: 'center', borderRadius: '12px', padding: '24px 16px', marginBottom: '20px',
    background: '#f9f9f9', border: '1px solid #eee',
  },
  statusText: { fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' },
  desc: { fontSize: '14px', color: '#555' },
  card: {
    background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px',
    padding: '16px', marginBottom: '20px',
  },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' },
  label: { color: '#888' },
  value: { fontWeight: 500 },
  payBtn: {
    display: 'block', width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
    background: '#4A90E2', color: '#fff', fontSize: '16px', fontWeight: 'bold',
    cursor: 'pointer', marginBottom: '12px', textAlign: 'center', textDecoration: 'none',
  },
  homeBtn: {
    width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #06C755',
    background: '#fff', color: '#06C755', fontSize: '15px', cursor: 'pointer',
  },
  error: { color: 'red', padding: '16px' },
  loading: { padding: '32px', textAlign: 'center', color: '#888' },
};

export default function BookingResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = params.get('bookingId') ?? '';
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBooking = () => {
    fetch('/api/civilian/bookings', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const found = (data.bookings as Booking[])?.find((b) => b.id === bookingId);
        if (found) setBooking(found);
      })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    if (!bookingId) return;
    fetchBooking();
  }, [bookingId]);

  useEffect(() => {
    if (booking && POLLING_STATUSES.has(booking.status)) {
      timerRef.current = setInterval(fetchBooking, 5000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [booking?.status]);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!booking) return <div style={styles.loading}>載入中…</div>;

  const info = STATUS_LABEL[booking.status] ?? { text: booking.status, color: '#888', desc: '' };

  return (
    <div style={styles.container}>
      <div style={styles.statusBox}>
        <p style={{ ...styles.statusText, color: info.color }}>{info.text}</p>
        <p style={styles.desc}>{info.desc}</p>
      </div>

      <div style={styles.card}>
        <div style={styles.row}>
          <span style={styles.label}>業務</span>
          <span style={styles.value}>{booking.agentProfile.user.displayName}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>時段</span>
          <span style={styles.value}>{formatTW(booking.slot.startAt)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>媒合費</span>
          <span style={styles.value}>NT$ {booking.amount}</span>
        </div>
      </div>

      {booking.status === 'LOCKED' && booking.paymentUrl && (
        <a href={booking.paymentUrl} style={styles.payBtn}>立即付款</a>
      )}

      <button style={styles.homeBtn} onClick={() => navigate('/civilian/my-bookings')}>
        查看我的預約
      </button>
    </div>
  );
}
