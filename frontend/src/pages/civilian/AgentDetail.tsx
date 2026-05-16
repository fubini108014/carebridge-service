import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { authHeaders } from '../../lib/liff';

interface Slot {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
}

interface Agent {
  id: string;
  bio: string | null;
  photoUrl: string | null;
  user: { displayName: string; pictureUrl: string | null };
  availabilitySlots: Slot[];
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  avatar: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', background: '#eee' },
  name: { fontSize: '18px', fontWeight: 'bold', margin: 0 },
  bio: { color: '#555', fontSize: '14px', marginTop: '4px' },
  sectionTitle: { fontSize: '15px', fontWeight: 'bold', margin: '16px 0 8px' },
  hint: { fontSize: '13px', color: '#06C755', marginBottom: '8px' },
  error: { color: 'red', padding: '16px' },
  loading: { padding: '32px', textAlign: 'center', color: '#888' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'none', border: 'none', color: '#06C755',
    fontSize: '15px', cursor: 'pointer', marginBottom: '12px', padding: 0,
  },
};

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/civilian/agents/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAgent(data.agent);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!agent) return <div style={styles.loading}>載入中…</div>;

  const events = agent.availabilitySlots
    .filter((s) => s.status === 'AVAILABLE')
    .map((s) => ({
      id: s.id,
      start: s.startAt,
      end: s.endAt,
      title: '可預約',
      backgroundColor: '#06C755',
      borderColor: '#059142',
    }));

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/civilian')}>
        ← 返回列表
      </button>

      <div style={styles.header}>
        {agent.user.pictureUrl ? (
          <img src={agent.user.pictureUrl} alt={agent.user.displayName} style={styles.avatar} />
        ) : (
          <div style={styles.avatar} />
        )}
        <div>
          <p style={styles.name}>{agent.user.displayName}</p>
          {agent.bio && <p style={styles.bio}>{agent.bio}</p>}
        </div>
      </div>

      <p style={styles.sectionTitle}>可預約時段</p>
      <p style={styles.hint}>點選綠色時段即可預約</p>

      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}
        eventClick={(info) => {
          navigate(
            `/civilian/booking/confirm?slotId=${info.event.id}&agentId=${agent.id}`
          );
        }}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        height="auto"
        locale="zh-tw"
        buttonText={{ today: '今天', prev: '‹', next: '›' }}
        allDaySlot={false}
      />
    </div>
  );
}
