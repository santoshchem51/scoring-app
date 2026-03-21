import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { ConsentDialog } from '../ConsentDialog';

describe('ConsentDialog', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('renders accept and decline buttons', () => {
    render(() => <ConsentDialog onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Decline')).toBeTruthy();
  });

  it('calls onAccept when Accept is clicked', () => {
    const onAccept = vi.fn();
    render(() => <ConsentDialog onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onDecline when Decline is clicked', () => {
    const onDecline = vi.fn();
    render(() => <ConsentDialog onAccept={vi.fn()} onDecline={onDecline} />);
    fireEvent.click(screen.getByText('Decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('mentions de-identified data and crash reports', () => {
    render(() => <ConsentDialog onAccept={vi.fn()} onDecline={vi.fn()} />);
    const text = document.body.textContent || '';
    expect(text).toContain('de-identified');
    expect(text).toContain('crash report');
  });
});
