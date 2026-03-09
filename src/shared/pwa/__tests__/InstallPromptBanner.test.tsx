import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const {
  mockShowInstallBanner,
  mockTriggerInstallPrompt,
  mockDismissAndEscalate,
  mockNeverDismiss,
  mockIosInstallSupported,
  mockIsInstalled,
} = vi.hoisted(() => ({
  mockShowInstallBanner: vi.fn(() => false),
  mockTriggerInstallPrompt: vi.fn(),
  mockDismissAndEscalate: vi.fn(),
  mockNeverDismiss: vi.fn(),
  mockIosInstallSupported: vi.fn(() => false),
  mockIsInstalled: vi.fn(() => false),
}));

vi.mock('../installPromptStore', () => ({
  showInstallBanner: mockShowInstallBanner,
  triggerInstallPrompt: mockTriggerInstallPrompt,
  dismissAndEscalate: mockDismissAndEscalate,
  neverDismiss: mockNeverDismiss,
  iosInstallSupported: mockIosInstallSupported,
  isInstalled: mockIsInstalled,
}));

// Must import AFTER mocks
import InstallPromptBanner from '../InstallPromptBanner';

describe('InstallPromptBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowInstallBanner.mockReturnValue(false);
    mockIosInstallSupported.mockReturnValue(false);
    mockIsInstalled.mockReturnValue(false);
  });

  it('renders nothing when showInstallBanner is false and not iOS', () => {
    render(() => <InstallPromptBanner />);
    expect(screen.queryByText(/install/i)).toBeNull();
  });

  it('shows install banner when showInstallBanner returns true', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    expect(screen.getByRole('button', { name: /install/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /not now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /don.t ask again/i })).toBeTruthy();
  });

  it('calls triggerInstallPrompt when Install is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    mockTriggerInstallPrompt.mockResolvedValue('accepted');
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /install/i }).click();
    expect(mockTriggerInstallPrompt).toHaveBeenCalledTimes(1);
  });

  it('calls dismissAndEscalate when Not now is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /not now/i }).click();
    expect(mockDismissAndEscalate).toHaveBeenCalledTimes(1);
  });

  it('calls neverDismiss when Don\'t ask again is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /don.t ask again/i }).click();
    expect(mockNeverDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows iOS instructions when iosInstallSupported is true', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    expect(screen.getByText(/add to home screen/i)).toBeTruthy();
  });

  it('has 44px minimum tap targets on all buttons', () => {
    mockShowInstallBanner.mockReturnValue(true);
    const { container } = render(() => <InstallPromptBanner />);
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      expect(btn.className).toContain('min-h-[44px]');
    });
  });
});
