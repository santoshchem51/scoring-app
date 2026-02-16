import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';
import ShareSheet from '../ShareSheet';

describe('ShareSheet', () => {
  it('renders share options (Copy link, WhatsApp, Cancel)', () => {
    render(() => (
      <ShareSheet url="https://example.com" text="Join my game" onClose={() => {}} />
    ));
    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.getByText('Share to WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    render(() => (
      <ShareSheet url="https://example.com" text="Join my game" onClose={onClose} />
    ));
    await fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <ShareSheet url="https://example.com" text="Join my game" onClose={onClose} />
    ));
    // The outermost fixed div acts as backdrop click target
    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    await fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
