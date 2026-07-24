import type { DeviceContext, SessionPlatform } from '@tradex/types';
import { Platform } from 'react-native';


import { getOrCreateDeviceId } from './secure-store';

function currentPlatform(): SessionPlatform {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB'; // Expo web fallback — the native platforms are the real targets.
}

export async function getDeviceContext(): Promise<DeviceContext> {
  const deviceId = await getOrCreateDeviceId();
  return {
    device_id: deviceId,
    device_name: Platform.OS === 'ios' ? 'iOS device' : Platform.OS === 'android' ? 'Android device' : 'Device',
    platform: currentPlatform(),
  };
}
