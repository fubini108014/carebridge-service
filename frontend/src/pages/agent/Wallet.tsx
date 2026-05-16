import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders } from '../../lib/liff';

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  status: 'PENDING' | 'AVAILABLE' | 'PAID';
  note: string | null;
  paidAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  PENDING:   { text: '待確認', color: '#f5a623', bg: '#fff8e1' },
  AVAILABLE: { text: '可提領', color: '#06C755', bg: '#f0fff4' },
  PAID:      { text: '已撥款', color: '#888', bg: '#f5f5f5' },
};

const GROUPS: ('PENDING' | 'AVAILABLE' | 'PAID')[] = ['PENDING', 'AVAILABLE', 'PAID'];

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  backBtn: { background: 'none', border: 'none', color: '#06C755', fontSize: '15px', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' },
  subtitle: { color: '#666', fontSize: '13px', margin: '0 0 24px' },
  summaryRow: { display: 'flex', gap: '12px', marginBottom: '24px' },
  summaryCard: { flex: 1, borderRadius: '10px', padding: '14px 12px', textAlign: 'center' as const },
  summaryAmt: { fontWeight: 'bold', fontSize: '18px' },
  summaryLabel: { fontSize: '11px', marginTop: '4px' },
  section: { marginBottom: '20px' },
  sectionTitle: { fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' },
  badge: { fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 },
  card: { border: '1px solid #eee', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: '#fff' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' },
  label: { color: '#999' },
  value: { color: '#333' },
  amount: { color: '#06C755', fontWeight: 'bold', fontSize: '15px' },
  empty: { textAlign: 'center', color: '#aaa', padding: '20px', fontSize: '13px' },
  loading: { padding: '32px', textAlign: 'center', color: '#aaa' },
  error: { color: 'red', padding: '16px' },
};

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

export default function AgentWallet() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/agent/wallet', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTransactions(data.transactions ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>載入中…</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  const grouped = {
    PENDING:   transactions.filter((t) => t.status === 'PENDING'),
    AVAILABLE: transactions.filter((t) => t.status === 'AVAILABLE'),
    PAID:      transactions.filter((t) => t.status === 'PAID'),
  };

  const sumOf = (list: WalletTransaction[]) =>
    list.reduce((acc, t) => acc + Number(t.amount), 0).toFixed(0);

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/agent')}>← 返回</button>
      <h1 style={styles.title}>我的錢包</h1>
      <p style={styles.subtitle}>陪診服務收益明細</p>

      <div style={styles.summaryRow}>
        {GROUPS.map((status) => {
          const info = STATUS_LABEL[status];
          return (
            <div key={status} style={{ ...styles.summaryCard, background: info.bg }}>
              <div style={{ ...styles.summaryAmt, color: info.color }}>NT$ {sumOf(grouped[status])}</div>
              <div style={{ ...styles.summaryLabel, color: info.color }}>{info.text}</div>
            </div>
          );
        })}
      </div>

      {GROUPS.map((status) => {
        const info = STATUS_LABEL[status];
        const list = grouped[status];
        return (
          <div key={status} style={styles.section}>
            <div style={styles.sectionTitle}>
              {info.text}
              <span style={{ ...styles.badge, background: info.bg, color: info.color }}>
                {list.length} 筆
              </span>
            </div>
            {list.length === 0 ? (
              <div style={styles.empty}>無紀錄</div>
            ) : (
              list.map((t) => (
                <div key={t.id} style={styles.card}>
                  <div style={styles.row}>
                    <span style={styles.amount}>NT$ {Number(t.amount).toFixed(0)}</span>
                    <span style={{ ...styles.badge, background: info.bg, color: info.color }}>{info.text}</span>
                  </div>
                  {t.note && (
                    <div style={styles.row}>
                      <span style={styles.label}>說明</span>
                      <span style={styles.value}>{t.note}</span>
                    </div>
                  )}
                  <div style={styles.row}>
                    <span style={styles.label}>建立時間</span>
                    <span style={styles.value}>{formatTW(t.createdAt)}</span>
                  </div>
                  {t.paidAt && (
                    <div style={styles.row}>
                      <span style={styles.label}>撥款時間</span>
                      <span style={styles.value}>{formatTW(t.paidAt)}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
