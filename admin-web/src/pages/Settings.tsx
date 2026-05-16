import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const KNOWN_KEYS: { key: string; label: string; desc: string; type?: string }[] = [
  { key: 'subscription_fee', label: '訂閱月費（NT$）', desc: '民眾訂閱費用', type: 'number' },
  { key: 'platform_cut_rate', label: '平台抽成比率', desc: '例：0.2 = 20%', type: 'number' },
  { key: 'max_demerit_points', label: '最大扣點上限', desc: '超過此值自動停權', type: 'number' },
  { key: 'cancel_window_hours', label: '取消退款窗口（小時）', desc: '服務前 N 小時內可退款', type: 'number' },
];

export default function Settings() {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.settings.get();
      setDraft({ ...data.settings });
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

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.settings.put(draft);
      showToast('設定已儲存');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addCustom() {
    if (!newKey.trim() || !newVal.trim()) return;
    const key = newKey.trim();
    const updated = { ...draft, [key]: newVal.trim() };
    setDraft(updated);
    setNewKey('');
    setNewVal('');
  }

  if (loading) return <p className="empty">載入中…</p>;

  // All keys: known + any extra from server
  const extraKeys = Object.keys(draft).filter((k) => !KNOWN_KEYS.find((kk) => kk.key === k));

  return (
    <>
      <h1 className="page-title">平台費率 & 規則設定</h1>

      {toast && <div className="alert alert-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 560 }}>
        {KNOWN_KEYS.map(({ key, label, desc, type }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{ marginTop: 0 }}>{label}</label>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{desc}</div>
            <input
              type={type ?? 'text'}
              step={type === 'number' ? 'any' : undefined}
              value={draft[key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              placeholder="（未設定）"
            />
          </div>
        ))}

        {extraKeys.map((key) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{ marginTop: 0, color: '#64748b' }}>{key}</label>
            <input
              value={draft[key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>新增自訂設定</div>
          <div className="row" style={{ marginBottom: 0 }}>
            <div className="col">
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key" />
            </div>
            <div className="col">
              <input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="value" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={addCustom} disabled={!newKey || !newVal}>新增</button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '儲存中…' : '儲存設定'}
          </button>
        </div>
      </div>
    </>
  );
}
