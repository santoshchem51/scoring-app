import { createSignal } from 'solid-js';
import { IS_NATIVE } from '../platform/platform';
import { swUpdateVisible } from './swUpdateStore';
import { trackEvent } from '../observability/analytics';

// ── Types ──

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

type DismissState = 'none' | 'soft' | 'hard' | 'never';

interface DismissData {
  tier: DismissState;
  until?: number;
}

// ── Constants ──

const DISMISS_KEY = 'pwa-install-dismiss';
const VISIT_KEY = 'pwa-visit-count';
const SOFT_MS = 7 * 24 * 60 * 60 * 1000;
const HARD_MS = 30 * 24 * 60 * 60 * 1000;

// ── Signals ──

const [promptEvent, setPromptEvent] = createSignal<BeforeInstallPromptEvent | null>(null);
const [installed, setInstalled] = createSignal(
  typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  ),
);
const [matchCount, setMatchCount] = createSignal(0);

// ── Dismiss Logic ──

function readDismiss(): DismissData {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return { tier: 'none' };
    return JSON.parse(raw) as DismissData;
  } catch {
    return { tier: 'none' };
  }
}

function isDismissed(): boolean {
  const data = readDismiss();
  if (data.tier === 'none') return false;
  if (data.tier === 'never') return true;
  if (!data.until) return false;
  return Date.now() < data.until;
}

export function getDismissState(): DismissState {
  return readDismiss().tier;
}

export function softDismiss(): void {
  const data: DismissData = { tier: 'soft', until: Date.now() + SOFT_MS };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

export function hardDismiss(): void {
  const data: DismissData = { tier: 'hard', until: Date.now() + HARD_MS };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

export function neverDismiss(): void {
  const data: DismissData = { tier: 'never' };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

/**
 * Auto-escalating dismiss: soft → hard → never.
 * If current dismiss has expired, escalate to next tier.
 */
export function dismissAndEscalate(): void {
  const current = readDismiss();
  if (current.tier === 'none' || (current.tier === 'soft' && current.until && Date.now() < current.until)) {
    softDismiss();
  } else if (current.tier === 'soft') {
    hardDismiss();
  } else {
    neverDismiss();
  }
}

// ── Trigger Logic ──

function hasTriggerCondition(): boolean {
  if (matchCount() >= 1) return true; // Primary: completed a match
  const visitCount = Number(localStorage.getItem(VISIT_KEY) || '0');
  return visitCount >= 3; // Fallback: 3rd visit
}

export function incrementVisitCount(): void {
  const count = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
  localStorage.setItem(VISIT_KEY, String(count));
}

export function setCompletedMatchCount(count: number): void {
  setMatchCount(count);
}

// ── Public API ──

export function captureInstallEvent(event: Event): void {
  setPromptEvent(event as BeforeInstallPromptEvent);
  trackEvent('pwa_install_prompt_shown');
}

export function markInstalled(): void {
  setInstalled(true);
  setPromptEvent(null);
}

export const isInstalled = installed;

export const showInstallBanner = (): boolean => {
  if (IS_NATIVE) return false;
  if (installed()) return false;
  if (!promptEvent()) return false;
  if (isDismissed()) return false;
  if (swUpdateVisible()) return false;
  if (!hasTriggerCondition()) return false;
  return true;
};

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | null> {
  const event = promptEvent();
  if (!event) return null;
  const result = await event.prompt();
  setPromptEvent(null);
  if (result.outcome === 'accepted') {
    setInstalled(true);
    trackEvent('pwa_install_accepted');
  }
  return result.outcome;
}

export function detectIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!CriOS|FxiOS|OPiOS|EdgiOS).)*Safari/.test(ua);
  return isIOS && isSafari;
}

export const iosInstallSupported = (): boolean => {
  if (IS_NATIVE) return false;
  return detectIOSSafari() && !installed();
};
