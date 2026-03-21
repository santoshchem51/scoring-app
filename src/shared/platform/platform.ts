import { Capacitor } from '@capacitor/core';

/** Evaluated ONCE at module load — never changes at runtime. */
export const IS_NATIVE = Capacitor.isNativePlatform();
export const PLATFORM = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
