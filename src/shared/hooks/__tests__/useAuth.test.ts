import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase before imports
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: null },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should export useAuth function', async () => {
    const mod = await import('../useAuth');
    expect(mod.useAuth).toBeDefined();
    expect(typeof mod.useAuth).toBe('function');
  });

  it('should provide signIn and signOut functions', async () => {
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    expect(typeof authState.signIn).toBe('function');
    expect(typeof authState.signOut).toBe('function');
  });

  it('should provide user and loading signals', async () => {
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    expect(typeof authState.user).toBe('function');
    expect(typeof authState.loading).toBe('function');
  });

  it('should call signInWithPopup on signIn', async () => {
    const firebaseAuth = await import('firebase/auth');
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    await authState.signIn();
    expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
  });

  it('should call firebase signOut on signOut', async () => {
    const firebaseAuth = await import('firebase/auth');
    const mod = await import('../useAuth');
    const authState = mod.useAuth();
    await authState.signOut();
    expect(firebaseAuth.signOut).toHaveBeenCalled();
  });
});
