import liff from '@line/liff';

const IS_DEV = import.meta.env.DEV;
const DEV_USER_ID = import.meta.env.VITE_DEV_LINE_USER_ID || 'dev-civilian-sub-001';

export async function initializeLiff() {
  if (IS_DEV && !import.meta.env.VITE_LIFF_ID) {
    console.info('[LIFF] Dev mode — skipping LIFF init, using DEV_USER_ID:', DEV_USER_ID);
    return;
  }

  await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });

  if (!liff.isLoggedIn()) {
    liff.login();
  }
}

export function getLineUserId(): string {
  if (IS_DEV && !import.meta.env.VITE_LIFF_ID) {
    return DEV_USER_ID;
  }
  return liff.getDecodedIDToken()?.sub ?? '';
}

export function getLiffProfile() {
  return liff.getProfile();
}

export function closeLiff() {
  if (!IS_DEV) liff.closeWindow();
}

export function authHeaders(): Record<string, string> {
  return { 'x-line-user-id': getLineUserId() };
}
