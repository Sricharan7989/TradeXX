import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';

import { getBiometricEnabled, setBiometricEnabled } from '../lib/secure-store';

/** Optional biometric-unlock toggle (Settings), per spec — off by default. */
export function useBiometric() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [hasHardware, isEnrolled, wasEnabled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        getBiometricEnabled(),
      ]);
      setAvailable(hasHardware && isEnrolled);
      setEnabledState(wasEnabled);
      setLoaded(true);
    })();
  }, []);

  const toggle = useCallback(async (next: boolean) => {
    if (next) {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable biometric unlock' });
      if (!result.success) return;
    }
    await setBiometricEnabled(next);
    setEnabledState(next);
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Tradex' });
    return result.success;
  }, []);

  return { available, enabled, loaded, toggle, unlock };
}
