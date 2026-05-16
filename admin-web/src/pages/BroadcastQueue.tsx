import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type BroadcastRequest = {
  id: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  clinicProfile: { name: string };
};

export default function BroadcastQueue() {
  const [items, setItems] = useState<BroadcastRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState<BroadcastRequest | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { requests } = await api.broadcast.list();
      setItems(requests);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.broadcast.review(selected.id, action, reviewNote || undefined);
      showToast(action === 'approve' ? '已批准推播' : '已拒絕推播');
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="page-title">推播訊息審核</h1>

      {toast && <div className="alert alert-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="empty">載入中…</p>
      ) : items.length === 0 ? (
        <p className="empty">目前沒有待審核推播申請</p>
      ) : (
        items.map((item) => (
          <div className="card" key={item.id}>
            <div className="card-header">
              <div>
                <div className="card-title">{item.clinicProfile.name}</div>
                <div className="card-sub">
                  申請時間：{new Date(item.createdAt).toLocaleString('zh-TW')}
                  {item.scheduledAt && ` ・ 排程：${new Date(item.scheduledAt).toLocaleString('zh-TW')}`}
                </div>
              </div>
              <span className="badge badge-yellow">待審核</span>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '10px 12px', fontSize: 13, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
              {item.content}
            </div>
            <div className="actions">
              <button className="btn btn-success" style={{ padding: '4px 12px' }} onClick={() => { setSelected(item); setAction('approve'); setReviewNote(''); }}>批准</button>
              <button className="btn btn-danger" style={{ padding: '4px 12px' }} onClick={() => { setSelected(item); setAction('reject'); setReviewNote(''); }}>拒絕</button>
            </div>
          </div>
        ))
      )}

      {selected && (
        <div className="modal-bg" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{action === 'approve' ? '批准推播' : '拒絕推播'}</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              診所：{selected.clinicProfile.name}
            </p>
            <label>備註（選填）</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={action === 'reject' ? '請說明拒絕原因' : '批准備註'}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>取消</button>
              <button
                className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? '處理中…' : action === 'approve' ? '確認批准' : '確認拒絕'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
