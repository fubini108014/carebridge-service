import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, getLineUserId } from '../../lib/liff';

interface CommissionSnapshot {
  id: string;
  createdAt: string;
  totalAmount: string;
  agentEarning: string;
  platformEarning: string;
  booking: {
    id: string;
    slot: { startAt: string; endAt: string };
    civilian: { displayName: string };
  };
}

interface WatermarkData {
  userId: string;
  timestamp: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '540px', margin: '0 auto', fontFamily: 'sans-serif' },
  backBtn: { background: 'none', border: 'none', color: '#06C755', fontSize: '15px', cursor: 'pointer', padding: 0, marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' },
  subtitle: { color: '#666', fontSize: '13px', margin: '0 0 20px' },
  canvasWrap: { position: 'relative', width: '100%', marginBottom: '16px' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: '8px' },
  tableWrap: { border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' },
  tableInner: { width: '100%', borderCollapse: 'collapse' as const },
  th: { background: '#f5f5f5', padding: '10px 12px', fontSize: '12px', color: '#666', textAlign: 'left' as const, borderBottom: '1px solid #eee' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f0f0f0' },
  earning: { color: '#06C755', fontWeight: 'bold' },
  loading: { padding: '32px', textAlign: 'center', color: '#aaa' },
  error: { color: 'red', padding: '16px' },
  empty: { textAlign: 'center', color: '#aaa', padding: '40px' },
};

function drawWatermark(canvas: HTMLCanvasElement, data: WatermarkData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#000';
  ctx.font = '11px monospace';
  ctx.rotate((-45 * Math.PI) / 180);

  const text = `${data.userId}  ${data.timestamp}`;
  const step = 160;
  const diagLen = Math.sqrt(rect.width ** 2 + rect.height ** 2);

  for (let x = -diagLen; x < diagLen * 2; x += step) {
    for (let y = -diagLen; y < diagLen * 2; y += 40) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
}

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

export default function AgentCommission() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [commissions, setCommissions] = useState<CommissionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/agent/commission', { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCommissions(data.commissions ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !tableRef.current || loading) return;

    const watermark: WatermarkData = {
      userId: getLineUserId(),
      timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    };

    const tableEl = tableRef.current;
    const canvas = canvasRef.current;

    const resizeCanvas = () => {
      canvas.style.width = `${tableEl.offsetWidth}px`;
      canvas.style.height = `${tableEl.offsetHeight}px`;
      drawWatermark(canvas, watermark);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [loading, commissions]);

  if (loading) return <div style={styles.loading}>載入中…</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/agent')}>← 返回</button>
      <h1 style={styles.title}>佣金紀錄</h1>
      <p style={styles.subtitle}>每筆成功預約媒合的收益明細</p>

      {commissions.length === 0 ? (
        <div style={styles.empty}>目前沒有佣金紀錄</div>
      ) : (
        <div style={styles.canvasWrap}>
          <div ref={tableRef} style={styles.tableWrap}>
            <table style={styles.tableInner}>
              <thead>
                <tr>
                  <th style={styles.th}>民眾</th>
                  <th style={styles.th}>時段</th>
                  <th style={styles.th}>媒合費</th>
                  <th style={styles.th}>業務收益</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td style={styles.td}>{c.booking.civilian.displayName}</td>
                    <td style={styles.td}>{formatTW(c.booking.slot.startAt)}</td>
                    <td style={styles.td}>NT$ {c.totalAmount}</td>
                    <td style={{ ...styles.td, ...styles.earning }}>NT$ {c.agentEarning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <canvas ref={canvasRef} style={styles.canvas} />
        </div>
      )}
    </div>
  );
}
