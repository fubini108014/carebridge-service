const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

function getKey(): string {
  return localStorage.getItem('adminKey') ?? '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': getKey(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export interface KycSubmission {
  id: string;
  status: string;
  reviewNote: string | null;
  submittedAt: string;
  idCardUrl: string;
  bankBookUrl: string;
  agentProfile: {
    id: string;
    user: { displayName: string; lineUserId: string };
  };
}

export const api = {
  kyc: {
    list: () => request<{ submissions: KycSubmission[] }>('/admin/kyc'),
    review: (id: string, action: 'approve' | 'reject', reviewNote?: string) =>
      request<{ ok: boolean }>(`/admin/kyc/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, reviewNote }),
      }),
  },

  // ─── Agents ──────────────────────────────────────────────────────────────

  agents: {
    list: () =>
      request<{
        agents: Array<{
          id: string;
          kycStatus: string;
          demeritPoints: number;
          isSuspended: boolean;
          bankAccount: string | null;
          user: { displayName: string; lineUserId: string; createdAt: string };
          _count: { bookings: number; kycSubmissions: number };
        }>;
      }>('/admin/agents'),

    demerit: (agentId: string, points: number, reason: string, bookingId?: string, adminNote?: string) =>
      request<{ ok: boolean }>(`/admin/agents/${agentId}/demerit`, {
        method: 'POST',
        body: JSON.stringify({ points, reason, bookingId, adminNote }),
      }),

    suspend: (agentId: string, suspend: boolean) =>
      request<{ ok: boolean }>(`/admin/agents/${agentId}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ suspend }),
      }),
  },

  // ─── Wallet ───────────────────────────────────────────────────────────────

  wallet: {
    adjust: (agentProfileId: string, amount: number, note?: string) =>
      request<{ transaction: unknown }>('/admin/wallet/adjust', {
        method: 'POST',
        body: JSON.stringify({ agentProfileId, amount, note }),
      }),
  },

  // ─── Broadcast ────────────────────────────────────────────────────────────

  broadcast: {
    list: () =>
      request<{
        requests: Array<{
          id: string;
          content: string;
          status: string;
          scheduledAt: string | null;
          createdAt: string;
          clinicProfile: { name: string };
        }>;
      }>('/admin/broadcast'),

    review: (id: string, action: 'approve' | 'reject', reviewNote?: string) =>
      request<{ ok: boolean }>(`/admin/broadcast/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, reviewNote }),
      }),
  },

  // ─── Settings ─────────────────────────────────────────────────────────────

  settings: {
    get: () => request<{ settings: Record<string, string> }>('/admin/settings'),
    put: (updates: Record<string, string>) =>
      request<{ ok: boolean }>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
  },
};
