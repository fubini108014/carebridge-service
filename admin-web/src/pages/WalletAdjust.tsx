import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Agent = {
  id: string;
  user: { displayName: string; lineUserId: string };
};

export default function WalletAdjust() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.agents.list().then(({ agents }) => setAgents(agents));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId || !amount) return;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt === 0) {
      setError('金額不可為 0');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.wallet.adjust(agentId, amt, note || undefined);
      setToast(`調帳成功：NT$${amt.toLocaleString()}`);
      setAmount('');
      setNote('');
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selected = agents.find((a) => a.id === agentId);

  return (
    <>
      <h1 className="page-title">手動調帳</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        正數為增加餘額（例如獎勵），負數為扣除餘額（例如退款）。
      </p>

      {toast && <div className="alert alert-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={submit}>
          <label>選擇業務 *</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
            <option value="">— 請選擇 —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.user.displayName} ({a.user.lineUserId})
              </option>
            ))}
          </select>

          {selected && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              ID：{selected.id}
            </div>
          )}

          <label>調整金額（NT$）*</label>
          <input
            type="number"
            step="0.01"
            placeholder="例：500 或 -200"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <label>備註（選填）</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：服務獎勵、退款扣除"
          />

          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={loading || !agentId || !amount}>
              {loading ? '處理中…' : '確認調帳'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
