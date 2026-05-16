import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Agent = {
  id: string;
  kycStatus: string;
  demeritPoints: number;
  isSuspended: boolean;
  bankAccount: string | null;
  user: { displayName: string; lineUserId: string; createdAt: string };
  _count: { bookings: number; kycSubmissions: number };
};

type Modal =
  | { type: 'demerit'; agent: Agent }
  | { type: 'suspend'; agent: Agent }
  | null;

const kycBadge: Record<string, string> = {
  NONE: 'badge-gray',
  PENDING: 'badge-yellow',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
};

export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<Modal>(null);

  // Demerit form
  const [points, setPoints] = useState('1');
  const [reason, setReason] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { agents } = await api.agents.list();
      setAgents(agents);
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

  async function submitDemerit() {
    if (modal?.type !== 'demerit') return;
    setSubmitting(true);
    try {
      await api.agents.demerit(modal.agent.id, Number(points), reason, bookingId || undefined, adminNote || undefined);
      showToast(`已對 ${modal.agent.user.displayName} 新增 ${points} 扣點`);
      setModal(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleSuspend(agent: Agent) {
    setSubmitting(true);
    try {
      const next = !agent.isSuspended;
      await api.agents.suspend(agent.id, next);
      showToast(next ? `${agent.user.displayName} 已停權` : `${agent.user.displayName} 已解除停權`);
      setModal(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="page-title">業務管理</h1>

      {toast && <div className="alert alert-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="empty">載入中…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>姓名</th>
              <th>KYC</th>
              <th>扣點</th>
              <th>預約數</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}>
                <td>
                  <div><strong>{a.user.displayName}</strong></div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{a.user.lineUserId}</div>
                </td>
                <td>
                  <span className={`badge ${kycBadge[a.kycStatus] ?? 'badge-gray'}`}>{a.kycStatus}</span>
                </td>
                <td>{a.demeritPoints}</td>
                <td>{a._count.bookings}</td>
                <td>
                  <span className={`badge ${a.isSuspended ? 'badge-red' : 'badge-green'}`}>
                    {a.isSuspended ? '已停權' : '正常'}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="btn btn-warning"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => { setModal({ type: 'demerit', agent: a }); setPoints('1'); setReason(''); setBookingId(''); setAdminNote(''); }}
                    >
                      扣點
                    </button>
                    <button
                      className={`btn ${a.isSuspended ? 'btn-success' : 'btn-danger'}`}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => setModal({ type: 'suspend', agent: a })}
                    >
                      {a.isSuspended ? '解除停權' : '停權'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.type === 'demerit' && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>新增扣點 — {modal.agent.user.displayName}</h2>
            <label>扣點數</label>
            <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} />
            <label>扣點原因 *</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例：服務態度不佳" />
            <label>相關預約 ID（選填）</label>
            <input value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="booking UUID" />
            <label>管理員備註（選填）</label>
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>取消</button>
              <button className="btn btn-warning" onClick={submitDemerit} disabled={submitting || !reason}>
                {submitting ? '處理中…' : '確認扣點'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'suspend' && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.agent.isSuspended ? '解除停權' : '停權'} — {modal.agent.user.displayName}</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
              {modal.agent.isSuspended
                ? '解除後業務可正常接單。'
                : '停權後業務將無法接受新預約。'}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>取消</button>
              <button
                className={`btn ${modal.agent.isSuspended ? 'btn-success' : 'btn-danger'}`}
                onClick={() => toggleSuspend(modal.agent)}
                disabled={submitting}
              >
                {submitting ? '處理中…' : '確認'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
