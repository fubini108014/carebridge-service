import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import { authHeaders } from '../../lib/liff';

interface Slot {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
}

interface Rule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

type ModalMode = 'slot' | 'rule' | null;

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: '#06C755',
  LOCKED: '#f0a500',
  BOOKED: '#e00',
  BLOCKED: '#aaa',
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '520px', margin: '0 auto', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  kycBanner: { background: '#fff9e6', border: '1px solid #f0c040', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#7a5c00' },
  kycBtn: { marginTop: '8px', padding: '8px 16px', background: '#f0c040', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  addBtns: { display: 'flex', gap: '8px', marginBottom: '16px' },
  btn: { flex: 1, padding: '10px', background: '#06C755', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' },
  btnOutline: { flex: 1, padding: '10px', background: '#fff', border: '2px solid #06C755', borderRadius: '8px', color: '#06C755', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' },
  rulesSection: { marginTop: '20px' },
  rulesTitle: { fontWeight: 'bold', fontSize: '15px', margin: '0 0 8px' },
  ruleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '6px', background: '#fff' },
  ruleText: { fontSize: '14px', color: '#333' },
  deleteBtn: { background: 'none', border: 'none', color: '#e00', fontSize: '16px', cursor: 'pointer', padding: '0 4px' },
  noRules: { color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '12px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '360px' },
  modalTitle: { fontWeight: 'bold', fontSize: '18px', margin: '0 0 16px' },
  formRow: { marginBottom: '14px' },
  formLabel: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px' },
  formInput: { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: '#fff' },
  modalBtns: { display: 'flex', gap: '8px', marginTop: '20px' },
  confirmBtn: { flex: 1, padding: '10px', background: '#06C755', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '10px', background: '#f0f0f0', border: 'none', borderRadius: '8px', color: '#555', fontWeight: 'bold', cursor: 'pointer' },
  errorTxt: { color: 'red', fontSize: '13px', marginTop: '8px' },
};

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AgentCalendar() {
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [kycStatus, setKycStatus] = useState<string>('NONE');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalError, setModalError] = useState('');

  // Slot form state
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');

  // Rule form state
  const [ruleDow, setRuleDow] = useState(1);
  const [ruleStart, setRuleStart] = useState('09:00');
  const [ruleEnd, setRuleEnd] = useState('10:00');

  async function load() {
    const headers = authHeaders();
    const [slotsRes, rulesRes, meRes] = await Promise.all([
      fetch('/api/agent/slots', { headers }),
      fetch('/api/agent/rules', { headers }),
      fetch('/api/agent/me', { headers }),
    ]);
    const [sd, rd, md] = await Promise.all([slotsRes.json(), rulesRes.json(), meRes.json()]);
    setSlots(sd.slots ?? []);
    setRules((rd.rules ?? []).filter((r: Rule) => r.isActive));
    setKycStatus(md.kycStatus ?? 'NONE');
  }

  useEffect(() => { load(); }, []);

  const events = slots.map((s) => ({
    id: s.id,
    start: s.startAt,
    end: s.endAt,
    title: s.status === 'AVAILABLE' ? '可預約' : s.status,
    backgroundColor: STATUS_COLOR[s.status] ?? '#888',
    borderColor: STATUS_COLOR[s.status] ?? '#888',
  }));

  async function handleEventClick(info: EventClickArg) {
    const slot = slots.find((s) => s.id === info.event.id);
    if (!slot || slot.status !== 'AVAILABLE') return;
    if (!confirm('確定刪除此時段？')) return;
    await fetch(`/api/agent/slots/${slot.id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  function handleDateSelect(info: DateSelectArg) {
    setSlotStart(toLocalDatetimeString(info.start));
    setSlotEnd(toLocalDatetimeString(info.end));
    setModalMode('slot');
    setModalError('');
  }

  async function submitSlot() {
    setModalError('');
    const res = await fetch('/api/agent/slots', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: new Date(slotStart).toISOString(), endAt: new Date(slotEnd).toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) { setModalError(data.error ?? '建立失敗'); return; }
    setModalMode(null);
    await load();
  }

  async function submitRule() {
    setModalError('');
    if (ruleStart >= ruleEnd) { setModalError('開始時間必須早於結束時間'); return; }
    const res = await fetch('/api/agent/rules', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek: ruleDow, startTime: ruleStart, endTime: ruleEnd }),
    });
    const data = await res.json();
    if (!res.ok) { setModalError(data.error ?? '建立失敗'); return; }
    setModalMode(null);
    await load();
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('確定刪除此週期規則（含未來已展開時段）？')) return;
    await fetch(`/api/agent/rules/${ruleId}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>我的排班</h1>
      </div>

      {kycStatus !== 'APPROVED' && (
        <div style={styles.kycBanner}>
          {kycStatus === 'NONE' && '尚未提交 KYC 認證，審核通過後才能接單。'}
          {kycStatus === 'PENDING' && 'KYC 審核中，請耐心等候。'}
          {kycStatus === 'REJECTED' && 'KYC 審核未通過，請重新提交資料。'}
          {(kycStatus === 'NONE' || kycStatus === 'REJECTED') && (
            <><br /><button style={styles.kycBtn} onClick={() => navigate('/agent/kyc')}>前往認證</button></>
          )}
        </div>
      )}

      <div style={styles.addBtns}>
        <button style={styles.btn} onClick={() => { setSlotStart(''); setSlotEnd(''); setModalMode('slot'); setModalError(''); }}>
          + 新增單一時段
        </button>
        <button style={styles.btnOutline} onClick={() => { setModalMode('rule'); setModalError(''); }}>
          + 週期規則
        </button>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}
        selectable
        select={handleDateSelect}
        eventClick={handleEventClick}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        height="auto"
        locale="zh-tw"
        buttonText={{ today: '今天', prev: '‹', next: '›' }}
        allDaySlot={false}
      />

      <div style={styles.rulesSection}>
        <p style={styles.rulesTitle}>週期規則</p>
        {rules.length === 0 ? (
          <p style={styles.noRules}>尚無週期規則</p>
        ) : (
          rules.map((r) => (
            <div key={r.id} style={styles.ruleRow}>
              <span style={styles.ruleText}>
                每週{DAY_NAMES[r.dayOfWeek]}　{r.startTime} ～ {r.endTime}
              </span>
              <button style={styles.deleteBtn} onClick={() => deleteRule(r.id)} title="刪除">✕</button>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div style={styles.overlay} onClick={() => setModalMode(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {modalMode === 'slot' ? (
              <>
                <p style={styles.modalTitle}>新增單一時段</p>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>開始時間</label>
                  <input type="datetime-local" style={styles.formInput} value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>結束時間</label>
                  <input type="datetime-local" style={styles.formInput} value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
                </div>
                {modalError && <p style={styles.errorTxt}>{modalError}</p>}
                <div style={styles.modalBtns}>
                  <button style={styles.cancelBtn} onClick={() => setModalMode(null)}>取消</button>
                  <button style={styles.confirmBtn} onClick={submitSlot}>確認新增</button>
                </div>
              </>
            ) : (
              <>
                <p style={styles.modalTitle}>新增週期規則</p>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>星期幾</label>
                  <select style={styles.formSelect} value={ruleDow} onChange={(e) => setRuleDow(Number(e.target.value))}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>每週{d}</option>)}
                  </select>
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>開始時間</label>
                  <input type="time" style={styles.formInput} value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>結束時間</label>
                  <input type="time" style={styles.formInput} value={ruleEnd} onChange={(e) => setRuleEnd(e.target.value)} />
                </div>
                {modalError && <p style={styles.errorTxt}>{modalError}</p>}
                <div style={styles.modalBtns}>
                  <button style={styles.cancelBtn} onClick={() => setModalMode(null)}>取消</button>
                  <button style={styles.confirmBtn} onClick={submitRule}>確認新增</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
