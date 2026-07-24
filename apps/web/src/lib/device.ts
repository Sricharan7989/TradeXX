import type { DeviceContext } from '@tradex/types';

const DEVICE_ID_STORAGE_KEY = 'tradex_device_id';

/** A stable per-browser device id, persisted in localStorage (not a secret). */
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  return id;
}

export function getDeviceContext(): DeviceContext {
  return {
    device_id: getOrCreateDeviceId(),
    device_name: typeof navigator === 'undefined' ? 'Web' : navigator.userAgent.slice(0, 120),
    platform: 'WEB',
  };
}
