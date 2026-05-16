import { useSearchParams, useNavigate } from 'react-router-dom';

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '32px 16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'center' },
  iconWrap: { marginBottom: '24px' },
  icon: { width: '72px', height: '72px', borderRadius: '50%', background: '#e8f5e9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' },
  title: { fontSize: '22px', fontWeight: 'bold', margin: '0 0 8px', color: '#222' },
  subtitle: { color: '#666', fontSize: '14px', margin: '0 0 32px', lineHeight: '1.6' },
  amountCard: { background: '#f0fff4', border: '1px solid #06C755', borderRadius: '10px', padding: '20px', marginBottom: '24px' },
  amountLabel: { color: '#555', fontSize: '13px', margin: '0 0 6px' },
  amount: { color: '#06C755', fontSize: '28px', fontWeight: 'bold', margin: 0 },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', textAlign: 'left' as const },
  infoLabel: { color: '#999' },
  infoValue: { color: '#333', fontFamily: 'monospace', fontSize: '12px' },
  backBtn: { width: '100%', padding: '14px', background: '#4A90E2', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginBottom: '12px' },
  scanBtn: { width: '100%', padding: '12px', background: '#fff', border: '1px solid #4A90E2', borderRadius: '8px', color: '#4A90E2', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' },
  notice: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#795548', textAlign: 'left' as const, marginTop: '20px' },
};

export default function ClinicVerifyResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const verificationId = searchParams.get('verificationId') ?? '';
  const amount = searchParams.get('amount') ?? '0';

  return (
    <div style={styles.container}>
      <div style={styles.iconWrap}>
        <div style={styles.icon}>✓</div>
      </div>

      <h1 style={styles.title}>核銷請求已送出</h1>
      <p style={styles.subtitle}>
        業務將於 30 分鐘內確認金額。<br />
        若業務未回應，系統將自動確認核銷。
      </p>

      <div style={styles.amountCard}>
        <p style={styles.amountLabel}>成交金額</p>
        <p style={styles.amount}>NT$ {Number(amount).toFixed(0)}</p>
      </div>

      {verificationId && (
        <div style={{ marginBottom: '24px', textAlign: 'left' }}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>核銷單號</span>
            <span style={styles.infoValue}>{verificationId.slice(0, 12)}…</span>
          </div>
        </div>
      )}

      <button style={styles.backBtn} onClick={() => navigate('/clinic/report')}>
        查看核銷紀錄
      </button>
      <button style={styles.scanBtn} onClick={() => navigate('/clinic/scan')}>
        繼續掃描下一位
      </button>

      <div style={styles.notice}>
        核銷完成後，業務收益將進入「待確認」狀態，每月 5 號統一結算撥款。
      </div>
    </div>
  );
}
