import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const {
  mockIosInstallSupported,
  mockIsInstalled,
} = vi.hoisted(() => ({
  mockIosInstallSupported: vi.fn(() => false),
  mockIsInstalled: vi.fn(() => false),
}));

vi.mock('../installPromptStore', () => ({
  iosInstallSupported: mockIosInstallSupported,
  isInstalled: mockIsInstalled,
}));

import IOSInstallSheet from '../IOSInstallSheet';

describe('IOSInstallSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIosInstallSupported.mockReturnValue(false);
    mockIsInstalled.mockReturnValue(false);
  });

  it('renders nothing when not iOS Safari', () => {
    const { container } = render(() => <IOSInstallSheet />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when open prop is true and iOS Safari', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <IOSInstallSheet open={true} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('shows step-by-step instructions', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <IOSInstallSheet open={true} onClose={() => {}} />);
    expect(screen.getByText(/share/i)).toBeTruthy();
    expect(screen.getByText(/add to home screen/i)).toBeTruthy();
  });

  it('has Got it button that calls onClose', () => {
    mockIosInstallSupported.mockReturnValue(true);
    const onClose = vi.fn();
    render(() => <IOSInstallSheet open={true} onClose={onClose} />);
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    expect(gotItBtn).toBeTruthy();
    gotItBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Got it button has min 44px tap target', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <IOSInstallSheet open={true} onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /got it/i });
    expect(btn.className).toContain('min-h-[44px]');
  });
});
