import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, getLineUserId } from '../../lib/liff';

interface Slot {
  id: string;
  startAt: string;
}

interface Agent {
  id: string;
  bio: string | null;
  photoUrl: string | null;
  user: { displayName: string; pictureUrl: string | null };
  availabilitySlots: Slot[];
}

interface Me {
  isSubscribed: boolean;
  subscriptionExpiresAt: string | null;
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  subBadge: {
    background: '#06C755', color: '#fff',
    fontSize: '12px', padding: '4px 10px', borderRadius: '12px',
  },
  subBanner: {
    background: '#fff9e6', border: '1px solid #f0c040',
    borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
  },
  subText: { margin: 0, fontSize: '14px', color: '#7a5c00' },
  subBtn: {
    marginTop: '8px', padding: '8px 16px',
    background: '#f0c040', border: 'none', borderRadius: '6px',
    fontWeight: 'bold', cursor: 'pointer', fontSize: '14px',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: '12px',
    border: '1px solid #e5e5e5', borderRadius: '10px',
    padding: '12px', marginBottom: '12px', cursor: 'pointer',
    background: '#fff',
  },
  avatar: { width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', background: '#eee', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px' },
  bio: { color: '#666', fontSize: '13px', margin: '0 0 4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  nextSlot: { fontSize: '12px', color: '#06C755', margin: 0 },
  noSlot: { fontSize: '12px', color: '#aaa', margin: 0 },
  arrow: { color: '#ccc', fontSize: '20px', flexShrink: 0 },
  empty: { textAlign: 'center', color: '#888', padding: '40px 0' },
  loading: { textAlign: 'center', color: '#888', padding: '40px 0' },
};

function formatTW(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AgentList() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = authHeaders();
    Promise.all([
      fetch('/api/civilian/agents').then((r) => r.json()),
      fetch('/api/civilian/me', { headers }).then((r) => r.json()),
    ]).then(([agentsData, meData]) => {
      setAgents(agentsData.agents ?? []);
      setMe(meData.user ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const isSubscribed =
    me?.isSubscribed &&
    (!me.subscriptionExpiresAt || new Date(me.subscriptionExpiresAt) > new Date());

  if (loading) return <div style={styles.loading}>載入中…</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>陪診業務</h1>
        {isSubscribed && <span style={styles.subBadge}>訂閱中</span>}
      </div>

      {!isSubscribed && (
        <div style={styles.subBanner}>
          <p style={styles.subText}>訂閱後才能向業務發出預約申請</p>
          <button style={styles.subBtn} onClick={() => navigate('/civilian/subscribe')}>
            立即訂閱 NT$99/月
          </button>
        </div>
      )}

      {agents.length === 0 ? (
        <div style={styles.empty}>目前沒有可預約的業務</div>
      ) : (
        agents.map((agent) => {
          const nextSlot = agent.availabilitySlots[0];
          return (
            <div
              key={agent.id}
              style={styles.card}
              onClick={() => navigate(`/civilian/agent/${agent.id}`)}
            >
              {agent.user.pictureUrl ? (
                <img src={agent.user.pictureUrl} alt={agent.user.displayName} style={styles.avatar as React.CSSProperties} />
              ) : (
                <div style={styles.avatar} />
              )}
              <div style={styles.info}>
                <p style={styles.name}>{agent.user.displayName}</p>
                {agent.bio && <p style={styles.bio}>{agent.bio}</p>}
                {nextSlot ? (
                  <p style={styles.nextSlot}>最近時段：{formatTW(nextSlot.startAt)}</p>
                ) : (
                  <p style={styles.noSlot}>目前無可預約時段</p>
                )}
              </div>
              <span style={styles.arrow}>›</span>
            </div>
          );
        })
      )}
    </div>
  );
}
