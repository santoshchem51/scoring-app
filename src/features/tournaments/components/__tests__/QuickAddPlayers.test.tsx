import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import QuickAddPlayers from '../QuickAddPlayers';

describe('QuickAddPlayers', () => {
  it('renders a textarea for entering names', () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/one name per line/i)).toBeTruthy();
  });

  it('displays parsed name count', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Alice\nBob\nCharlie' } });
    expect(screen.getByText(/3 name/)).toBeTruthy();
  });

  it('trims whitespace from names', async () => {
    const onSubmit = vi.fn();
    render(() => <QuickAddPlayers onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: '  Alice  \n  Bob  ' } });
    const button = screen.getByRole('button', { name: /add 2 player/i });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith(['Alice', 'Bob']);
  });

  it('filters out empty lines', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Alice\n\n\nBob\n\n' } });
    expect(screen.getByText(/2 name/)).toBeTruthy();
  });

  it('shows error when a name exceeds 100 characters', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    const longName = 'A'.repeat(101);
    fireEvent.input(textarea, { target: { value: longName } });
    expect(screen.getByText(/exceeds 100 characters/i)).toBeTruthy();
  });

  it('shows error when more than 100 names are entered', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    const names = Array.from({ length: 101 }, (_, i) => `Player${i + 1}`).join('\n');
    fireEvent.input(textarea, { target: { value: names } });
    expect(screen.getByText(/maximum 100 names/i)).toBeTruthy();
  });

  it('shows duplicate warning for case-insensitive matches with existing names', async () => {
    render(() => (
      <QuickAddPlayers onSubmit={vi.fn()} existingNames={['Alice', 'Bob']} />
    ));
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'alice\nCharlie' } });
    expect(screen.getByText(/duplicate/i)).toBeTruthy();
  });

  it('disables submit button when there are no valid names', () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const button = screen.getByRole('button', { name: /add/i });
    expect(button).toHaveProperty('disabled', true);
  });

  it('accepts intra-input duplicates without warning (current behavior)', async () => {
    const onSubmit = vi.fn();
    render(() => <QuickAddPlayers onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText(/one name per line/i) as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'Alice\nAlice' } });

    // Component only checks against existingNames, not within the textarea itself
    expect(screen.queryByText(/duplicate/i)).toBeNull();
    expect(screen.getByText(/2 name/)).toBeTruthy();

    const button = screen.getByRole('button', { name: /add 2 player/i });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith(['Alice', 'Alice']);
  });
});
