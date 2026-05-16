import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { KycSubmission } from '../lib/api';

export default function KycList() {
  const [items, setItems] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<KycSubmission | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { submissions } = await api.kyc.list();
      setItems(submissions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openModal(item: KycSubmission, act: 'approve' | 'reject') {
    setSelected(item);
    setAction(act);
    setReviewNote('');
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.kyc.review(selected.id, action, reviewNote || undefined);
      setToast(action === 'approve' ? '已通過審核' : '已拒絕');
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(''), 3000);
    }
  }

  return (
    <>
      <h1 className="page-title">KYC 審核佇列</h1>

      {toast && <div className="alert alert-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="empty">載入中…</p>
      ) : items.length === 0 ? (
        <p className="empty">目前沒有待審核申請</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>業務姓名</th>
              <th>LINE ID</th>
              <th>申請時間</th>
              <th>文件</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.agentProfile.user.displayName}</strong></td>
                <td style={{ fontSize: 11, color: '#64748b' }}>{item.agentProfile.user.lineUserId}</td>
                <td>{new Date(item.submittedAt).toLocaleString('zh-TW')}</td>
                <td>
                  <div className="actions">
                    <a href={item.idCardUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                      身份證
                    </a>
                    <a href={item.bankBookUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
                      存摺
                    </a>
                  </div>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-success" style={{ padding: '4px 10px' }} onClick={() => openModal(item, 'approve')}>通過</button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={() => openModal(item, 'reject')}>拒絕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="modal-bg" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{action === 'approve' ? '通過 KYC 審核' : '拒絕 KYC 申請'}</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              業務：{selected.agentProfile.user.displayName}
            </p>
            <label>備註（選填）</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={action === 'reject' ? '請說明拒絕原因，將透過 LINE 通知業務' : '審核備註'}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>取消</button>
              <button
                className={`btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? '處理中…' : action === 'approve' ? '確認通過' : '確認拒絕'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
