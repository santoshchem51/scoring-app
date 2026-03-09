import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const {
  mockSwUpdateVisible,
  mockApplyUpdate,
  mockDismissUpdate,
  mockUpdateAcknowledged,
  mockClearUpdateAck,
} = vi.hoisted(() => ({
  mockSwUpdateVisible: vi.fn(() => false),
  mockApplyUpdate: vi.fn(),
  mockDismissUpdate: vi.fn(),
  mockUpdateAcknowledged: vi.fn(() => false),
  mockClearUpdateAck: vi.fn(),
}));

vi.mock('../swUpdateStore', () => ({
  swUpdateVisible: mockSwUpdateVisible,
  applyUpdate: mockApplyUpdate,
  dismissUpdate: mockDismissUpdate,
  updateAcknowledged: mockUpdateAcknowledged,
  clearUpdateAck: mockClearUpdateAck,
}));

// Must import AFTER mocks
import SWUpdateToast from '../SWUpdateToast';

describe('SWUpdateToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSwUpdateVisible.mockReturnValue(false);
    mockUpdateAcknowledged.mockReturnValue(false);
  });

  it('renders aria-live region even when hidden', () => {
    const { container } = render(() => <SWUpdateToast />);
    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl).toBeTruthy();
    expect(statusEl?.getAttribute('aria-live')).toBe('polite');
  });

  it('hides toast content when swUpdateVisible is false', () => {
    render(() => <SWUpdateToast />);
    expect(screen.queryByText('A new version is available')).toBeNull();
  });

  it('shows toast when swUpdateVisible is true', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    expect(screen.getByText('A new version is available')).toBeTruthy();
    expect(screen.getByRole('button', { name: /update/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remind me tomorrow/i })).toBeTruthy();
  });

  it('calls applyUpdate when Update button is clicked', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    screen.getByRole('button', { name: /update/i }).click();
    expect(mockApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls dismissUpdate when Remind me tomorrow is clicked', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    screen.getByRole('button', { name: /remind me tomorrow/i }).click();
    expect(mockDismissUpdate).toHaveBeenCalledTimes(1);
  });

  it('has z-40 and fixed positioning when visible', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    const { container } = render(() => <SWUpdateToast />);
    const toast = container.querySelector('.fixed.z-40');
    expect(toast).toBeTruthy();
  });
});
