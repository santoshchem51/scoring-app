import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ClaimPlaceholder from '../ClaimPlaceholder';

describe('ClaimPlaceholder', () => {
  const placeholders = [
    { id: 'r1', playerName: 'John Smith' },
    { id: 'r2', playerName: 'Jane Doe' },
  ];

  it('renders list of unclaimed placeholder names', () => {
    render(() => <ClaimPlaceholder placeholders={placeholders} onClaim={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('John Smith')).toBeTruthy();
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('calls onClaim with registration id when a name is clicked', async () => {
    const onClaim = vi.fn();
    render(() => <ClaimPlaceholder placeholders={placeholders} onClaim={onClaim} onSkip={vi.fn()} />);
    await fireEvent.click(screen.getByText('John Smith'));
    expect(onClaim).toHaveBeenCalledWith('r1');
  });

  it('renders skip button', () => {
    render(() => <ClaimPlaceholder placeholders={placeholders} onClaim={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('None of these')).toBeTruthy();
  });

  it('calls onSkip when skip button is clicked', async () => {
    const onSkip = vi.fn();
    render(() => <ClaimPlaceholder placeholders={placeholders} onClaim={vi.fn()} onSkip={onSkip} />);
    await fireEvent.click(screen.getByText('None of these'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('shows prompt text', () => {
    render(() => <ClaimPlaceholder placeholders={placeholders} onClaim={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('Are you one of these players?')).toBeTruthy();
  });
});
