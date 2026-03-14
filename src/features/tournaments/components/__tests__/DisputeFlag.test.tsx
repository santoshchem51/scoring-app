import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import DisputeFlag from '../DisputeFlag';

describe('DisputeFlag', () => {
  it('renders the flag button', () => {
    render(() => <DisputeFlag onFlag={vi.fn()} canFlag={true} />);
    expect(screen.getByText('Flag Dispute')).toBeTruthy();
  });

  it('hides flag button when canFlag is false', () => {
    render(() => <DisputeFlag onFlag={vi.fn()} canFlag={false} />);
    expect(screen.queryByText('Flag Dispute')).toBeNull();
  });

  it('shows reason input when flag button is clicked', async () => {
    render(() => <DisputeFlag onFlag={vi.fn()} canFlag={true} />);
    await fireEvent.click(screen.getByText('Flag Dispute'));
    expect(screen.getByPlaceholderText('Describe the issue...')).toBeTruthy();
  });

  it('calls onFlag with reason when submitted', async () => {
    const onFlag = vi.fn();
    render(() => <DisputeFlag onFlag={onFlag} canFlag={true} />);
    await fireEvent.click(screen.getByText('Flag Dispute'));
    const input = screen.getByPlaceholderText('Describe the issue...');
    await fireEvent.input(input, { target: { value: 'Wrong score recorded' } });
    await fireEvent.click(screen.getByText('Submit'));
    expect(onFlag).toHaveBeenCalledWith('Wrong score recorded');
  });

  it('does not submit with empty reason', async () => {
    const onFlag = vi.fn();
    render(() => <DisputeFlag onFlag={onFlag} canFlag={true} />);
    await fireEvent.click(screen.getByText('Flag Dispute'));
    await fireEvent.click(screen.getByText('Submit'));
    expect(onFlag).not.toHaveBeenCalled();
  });
});
